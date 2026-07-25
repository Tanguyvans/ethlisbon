import { NextResponse } from "next/server";
import { handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { insertEvent, updateHolder } from "@/lib/db/repo";
import { hashscanTxUrl } from "@/lib/hedera/format";
import { txReceiptSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Holder approved a token allowance to the treasury client-side
 *  (AccountAllowanceApproveTransaction), which is what lets us schedule an auto-reclaim transfer
 *  later without needing their signature again. We trust the client-reported txId here — a
 *  production build should confirm via the mirror node's `/accounts/{id}/allowances/tokens`
 *  endpoint before relying on it for a real compliance action. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    requireToken(tokenId);
    const { txId } = txReceiptSchema.parse(await readJson<unknown>(req));

    updateHolder(tokenId, accountId, { allowanceGranted: true });
    insertEvent({ tokenId, accountId, type: "ALLOWANCE_APPROVE", txId, hashscanUrl: hashscanTxUrl(txId) });

    return NextResponse.json({ allowanceGranted: true });
  });
}
