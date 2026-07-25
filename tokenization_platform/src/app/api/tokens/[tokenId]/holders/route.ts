import { NextResponse } from "next/server";
import { handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { ensureHolder, getHolder } from "@/lib/db/repo";
import { registerHolderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** A holder "registers" (connects their wallet and shows up in the admin queue) before doing
 *  anything on-chain. Association/allowance/whitelisting are separate steps after this, each
 *  logging their own on-chain event — registering itself is purely local bookkeeping. */
export async function POST(req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  return handleRoute(async () => {
    const { tokenId } = await params;
    requireToken(tokenId);

    const { accountId, evmAddress } = registerHolderSchema.parse(await readJson<unknown>(req));
    ensureHolder(tokenId, accountId, evmAddress);

    return NextResponse.json({ holder: getHolder(tokenId, accountId) }, { status: 201 });
  });
}
