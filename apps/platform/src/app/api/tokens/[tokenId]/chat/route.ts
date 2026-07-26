import { NextResponse } from "next/server";
import { getAddress } from "ethers";
import { z } from "zod";
import { ApiError, handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { getHolder } from "@/lib/db/repo";
import { checkChatRateLimit } from "@/lib/chat/rateLimit";
import type { TokenRecord } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Holder-facing "ask about this token" chat. Gated to connected wallets that
 * already hold the token (same ownership check HolderPanel.tsx uses), then
 * proxied to the locked-down `pr` Hermes profile's OpenAI-compatible API
 * server (see apps/agent/server.py's PR_* constants / gw_pr) — never to the
 * operator gateway. That profile only has the hedera_read/evm_read/
 * subgraph_read MCPs and no terminal/file tools, so there is no code path
 * from this chat to any mint/transfer/reclaim/pause/whitelist operation or to
 * any operator secret, regardless of what a message asks for.
 */

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const chatRequestSchema = z.object({
  accountId: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1).max(30),
});

// The tokenization app inherits these from the container process env — set by
// apps/agent/server.py's TokenizationApp.start() alongside the other internal
// loopback secrets (TOKENIZATION_AGENT_SECRET, webhook secrets, etc.).
const PR_API_SERVER_URL = process.env.HERMES_PR_API_SERVER_URL || "http://127.0.0.1:8643";
const PR_API_SERVER_KEY = process.env.HERMES_PR_API_SERVER_KEY || "";

function tokenContextMessage(token: TokenRecord) {
  const identifier =
    token.blockchain === "EVM" ? `Sepolia contract address ${token.id}` : `Hedera token id ${token.id}`;
  return {
    role: "system" as const,
    content: [
      "The holder is chatting from this token's page, so treat it as the default subject:",
      `- Name: ${token.name} (${token.symbol})`,
      `- Chain: ${token.blockchain} (${token.network})`,
      `- Identifier: ${identifier}`,
      `- Type: ${token.tokenType}, decimals: ${token.decimals}`,
      "Use your read-only tools scoped to this identifier to answer; never guess a number.",
    ].join("\n"),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  return handleRoute(async () => {
    const { tokenId } = await params;
    const token = requireToken(tokenId);

    const { accountId, messages } = chatRequestSchema.parse(await readJson<unknown>(req));

    const isEvmAddress = accountId.startsWith("0x");
    if ((token.blockchain === "EVM") !== isEvmAddress) {
      throw new ApiError("Connect the wallet that matches this token's chain to chat.", 400);
    }
    const normalizedAccountId = token.blockchain === "EVM" ? getAddress(accountId) : accountId;

    // Ownership gate: same holder-row check HolderPanel.tsx's UI relies on.
    // The underlying data this chat surfaces is public on-chain/indexed data,
    // so this is a product gate (chat is a holder perk), not a data-secrecy
    // control — proportionate to what's actually being protected.
    const holder = getHolder(tokenId, normalizedAccountId);
    if (!holder) {
      throw new ApiError("Connect a wallet that holds this token to chat about it.", 403);
    }

    if (!checkChatRateLimit(`${tokenId}:${normalizedAccountId}`)) {
      throw new ApiError("Too many messages — please wait a moment before trying again.", 429);
    }

    if (!PR_API_SERVER_KEY) {
      throw new ApiError("Chat is not configured on this deployment.", 503);
    }

    // Keep only the tail of what the client sent — the system message above
    // always carries the full, current token identity, so older turns don't
    // need to re-establish it, and this bounds request size regardless of how
    // long the client-side conversation has grown.
    const trimmedMessages = messages.slice(-20);

    let upstream: Response;
    try {
      upstream = await fetch(`${PR_API_SERVER_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${PR_API_SERVER_KEY}`,
        },
        body: JSON.stringify({
          model: "hermes-pr",
          stream: true,
          messages: [tokenContextMessage(token), ...trimmedMessages],
        }),
      });
    } catch (err) {
      console.error("pr chat upstream unreachable", err);
      throw new ApiError("The token chat assistant is temporarily unavailable.", 503);
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("pr chat upstream error", upstream.status, detail);
      throw new ApiError("The token chat assistant is temporarily unavailable.", 502);
    }

    // Pass the upstream SSE stream straight through rather than buffering —
    // handleRoute's NextResponse.json error path above still applies to
    // every failure branch; only the success path returns a stream.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
        "cache-control": "no-cache, no-transform",
      },
    });
  });
}
