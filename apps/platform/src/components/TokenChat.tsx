"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWalletConnect";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { streamChatCompletion } from "@/lib/chat/stream";
import { Button, Card, ErrorText, TextInput } from "@/components/ui";
import type { HolderRecord, TokenRecord } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Holder-only "ask about this token" chat panel. Proxied server-side
 * (/api/tokens/[tokenId]/chat) to the locked-down `pr` Hermes profile — a
 * read-only agent with no path to mint/transfer/reclaim/pause/whitelist, so
 * this is purely a Q&A surface regardless of what's asked.
 */
export default function TokenChat({ token, holders }: { token: TokenRecord; holders: HolderRecord[] }) {
  const hederaWallet = useWallet();
  const evmWallet = useEvmWallet();
  const activeWallet = token.blockchain === "EVM" ? evmWallet : hederaWallet;
  const { accountId } = activeWallet;

  const holder = useMemo(
    () => holders.find((h) => h.accountId.toLowerCase() === accountId?.toLowerCase()) ?? null,
    [holders, accountId],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Chat is a holder perk on data that's public anyway — no accountId or no
  // holder row means nothing to show here (HolderPanel above already covers
  // "connect a wallet" / "join this token").
  if (!accountId || !holder) return null;

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    const history = [...messages, { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant" as const, content: "" }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/tokens/${token.id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, messages: history }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Chat request failed (${res.status})`);
      }
      let assistantText = "";
      for await (const delta of streamChatCompletion(res)) {
        assistantText += delta;
        setMessages([...history, { role: "assistant", content: assistantText }]);
      }
      if (!assistantText) {
        setMessages(history);
        setError("No response — please try again.");
      }
    } catch (err) {
      setMessages(history);
      setError(err instanceof Error ? err.message : "Chat request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ask about {token.symbol}</h2>
        <span className="text-xs text-zinc-500">Read-only — answers questions, can&apos;t transact</span>
      </div>

      {messages.length > 0 && (
        <div ref={scrollRef} className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                message.role === "user"
                  ? "self-end bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "self-start bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              {message.content || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <TextInput
          className="flex-1"
          placeholder="Ask about holders, transfers, supply…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? "Asking…" : "Ask"}
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
