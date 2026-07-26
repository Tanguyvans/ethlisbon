import { NextResponse } from "next/server";
import { handleRoute, readJson } from "@/lib/api/helpers";
import { insertEvent, insertToken, listTokens } from "@/lib/db/repo";
import { createEvmTokenSchema } from "@/lib/validation";
import { deployEvmToken, getEvmOperatorAddress } from "@/lib/evm/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () =>
    NextResponse.json({ tokens: listTokens().filter((token) => token.blockchain === "EVM") })
  );
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = await readJson<Record<string, unknown>>(req);
    const input = createEvmTokenSchema.parse({ ...body, blockchain: "EVM" });
    const compliance = input.compliance.worldIdRequired
      ? { ...input.compliance, kycRequired: true }
      : input.compliance;

    const created = await deployEvmToken({
      name: input.name,
      symbol: input.symbol,
      decimals: input.decimals,
      initialSupply: input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      compliance,
    });

    const token = insertToken({
      id: created.tokenId,
      blockchain: "EVM",
      network: "sepolia",
      name: input.name,
      symbol: input.symbol,
      tokenType: "FUNGIBLE",
      decimals: input.decimals,
      initialSupply: input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      treasuryAccountId: getEvmOperatorAddress(),
      assetCategory: input.assetCategory,
      memo: input.memo,
      compliance,
      customFee: null,
      keys: created.keys,
      createTxId: created.txId,
    });

    insertEvent({
      tokenId: token.id,
      type: "CREATE_TOKEN",
      detail: {
        name: token.name,
        symbol: token.symbol,
        tokenType: token.tokenType,
        blockchain: "EVM",
        network: "sepolia",
      },
      txId: created.txId,
      hashscanUrl: created.explorerUrl,
    });

    return NextResponse.json({ token }, { status: 201 });
  });
}
