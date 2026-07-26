import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { getHolder, insertEvent, updateHolder } from "@/lib/db/repo";
import { hashscanTxUrl } from "@/lib/hedera/format";
import { allowanceReceiptSchema } from "@/lib/validation";
import { waitForTokenAllowance } from "@/lib/hedera/mirrorNode";

export const dynamic = "force-dynamic";

/** Holder approved a token allowance to the treasury client-side. Mirror Node confirmation is
 * required before this off-chain state can unlock a liveness-gated distribution. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    const token = requireToken(tokenId);
    if (!token.compliance.livenessEnabled) {
      throw new ApiError("This token does not use recurring liveness.", 409);
    }
    const holder = getHolder(tokenId, accountId);
    if (!holder || !holder.associated) {
      throw new ApiError("Associate this token before approving automatic return.", 409);
    }
    const { txId } = allowanceReceiptSchema.parse(await readJson<unknown>(req));
    const minimumAmount = BigInt(10) ** BigInt(token.decimals);
    const confirmedAmount = await waitForTokenAllowance({
      ownerAccountId: accountId,
      spenderAccountId: token.treasuryAccountId,
      tokenId,
      minimumAmount,
    });

    updateHolder(tokenId, accountId, { allowanceGranted: true });
    insertEvent({
      tokenId,
      accountId,
      type: "ALLOWANCE_APPROVE",
      detail: { confirmedAmountBaseUnits: confirmedAmount.toString() },
      txId,
      hashscanUrl: hashscanTxUrl(txId),
    });

    return NextResponse.json({ allowanceGranted: true, confirmedAmount: confirmedAmount.toString() });
  });
}
