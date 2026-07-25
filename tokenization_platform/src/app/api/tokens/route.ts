import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson } from "@/lib/api/helpers";
import { insertEvent, insertToken, listTokens } from "@/lib/db/repo";
import { createToken } from "@/lib/hedera/tokenService";
import { getOperatorId } from "@/lib/hedera/client";
import { createTokenSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => NextResponse.json({ tokens: listTokens() }));
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    // Each deployment backs exactly one token — the operator key is also the
    // treasury/admin key for it, and the public storefront (src/app/page.tsx)
    // assumes a single token to display. Reject instead of quietly minting a
    // second one under the same operator.
    const [existing] = listTokens();
    if (existing) {
      throw new ApiError(
        `This deployment already has a token: ${existing.name} (${existing.id}). Only one token is supported per deployment.`,
        409
      );
    }

    const body = await readJson<unknown>(req);
    const input = createTokenSchema.parse(body);

    const created = await createToken({
      name: input.name,
      symbol: input.symbol,
      tokenType: input.tokenType,
      decimals: input.tokenType === "NFT" ? 0 : input.decimals,
      initialSupply: input.tokenType === "NFT" ? 0 : input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      memo: input.memo,
      compliance: input.compliance,
      customFee: input.customFee ?? null,
    });

    const token = insertToken({
      id: created.tokenId,
      name: input.name,
      symbol: input.symbol,
      tokenType: input.tokenType,
      decimals: input.tokenType === "NFT" ? 0 : input.decimals,
      initialSupply: input.tokenType === "NFT" ? 0 : input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      treasuryAccountId: getOperatorId().toString(),
      assetCategory: input.assetCategory,
      memo: input.memo,
      compliance: input.compliance,
      customFee: input.customFee ?? null,
      keys: created.keys,
      createTxId: created.txId,
    });

    insertEvent({
      tokenId: token.id,
      type: "CREATE_TOKEN",
      detail: { name: token.name, symbol: token.symbol, tokenType: token.tokenType },
      txId: created.txId,
      hashscanUrl: created.hashscanUrl,
    });

    return NextResponse.json({ token }, { status: 201 });
  });
}
