import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireToken } from "@/lib/api/helpers";
import { getHolder, insertEvent, updateHolder } from "@/lib/db/repo";
import { freezeAccount, revokeKyc } from "@/lib/hedera/tokenService";
import { cancelScheduledReclaim } from "@/lib/hedera/scheduleService";

export const dynamic = "force-dynamic";

/** Admin de-whitelists a holder: revokes KYC and/or (re-)freezes the account, and cancels any
 *  pending auto-reclaim schedule since it's superseded by this explicit action. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    const token = requireToken(tokenId);
    const holder = getHolder(tokenId, accountId);
    if (!holder) throw new ApiError("Holder has not registered for this token.", 404);

    if (token.compliance.kycRequired && holder.kycGranted) {
      const result = await revokeKyc(tokenId, accountId);
      updateHolder(tokenId, accountId, { kycGranted: false });
      insertEvent({ tokenId, accountId, type: "REVOKE_KYC", txId: result.txId, hashscanUrl: result.hashscanUrl });
    }
    if (token.compliance.freezeDefault && !holder.frozen) {
      const result = await freezeAccount(tokenId, accountId);
      updateHolder(tokenId, accountId, { frozen: true });
      insertEvent({ tokenId, accountId, type: "FREEZE", txId: result.txId, hashscanUrl: result.hashscanUrl });
    }
    if (holder.activeScheduleId) {
      await cancelScheduledReclaim(holder.activeScheduleId);
      updateHolder(tokenId, accountId, { activeScheduleId: null, activeScheduleExpiresAt: null });
      insertEvent({ tokenId, accountId, type: "CANCEL_RECLAIM", detail: { reason: "holder revoked" } });
    }

    updateHolder(tokenId, accountId, { status: "REVOKED" });
    return NextResponse.json({ holder: getHolder(tokenId, accountId) });
  });
}
