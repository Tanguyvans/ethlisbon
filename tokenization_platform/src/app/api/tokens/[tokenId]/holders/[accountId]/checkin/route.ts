import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireToken } from "@/lib/api/helpers";
import { getHolder, insertEvent, updateHolder } from "@/lib/db/repo";
import { cancelScheduledReclaim, scheduleAutoReclaim } from "@/lib/hedera/scheduleService";

export const dynamic = "force-dynamic";

/** "Proof of life": resets the liveness clock and, for liveness-enabled tokens, re-arms the
 *  auto-reclaim safety net (cancels any existing schedule and creates a fresh one expiring
 *  `livenessPeriodSeconds` from now, capturing the holder's current balance). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    const token = requireToken(tokenId);
    const holder = getHolder(tokenId, accountId);
    if (!holder) throw new ApiError("Holder has not registered for this token.", 404);

    if (holder.activeScheduleId) {
      await cancelScheduledReclaim(holder.activeScheduleId);
      updateHolder(tokenId, accountId, { activeScheduleId: null, activeScheduleExpiresAt: null });
    }

    const now = new Date();
    updateHolder(tokenId, accountId, { lastCheckinAt: now.toISOString() });
    insertEvent({ tokenId, accountId, type: "CHECKIN" });

    let schedule: Awaited<ReturnType<typeof scheduleAutoReclaim>> | null = null;
    if (token.compliance.livenessEnabled && token.compliance.livenessPeriodSeconds && holder.allowanceGranted) {
      const expiresAt = new Date(now.getTime() + token.compliance.livenessPeriodSeconds * 1000);
      try {
        schedule = await scheduleAutoReclaim(tokenId, accountId, expiresAt);
        updateHolder(tokenId, accountId, {
          activeScheduleId: schedule.scheduleId,
          activeScheduleExpiresAt: schedule.expiresAt,
        });
        insertEvent({
          tokenId,
          accountId,
          type: "SCHEDULE_RECLAIM",
          detail: { amount: schedule.amount, expiresAt: schedule.expiresAt },
          txId: schedule.txId,
          hashscanUrl: schedule.hashscanUrl,
        });
      } catch (err) {
        // No balance yet (holder hasn't received tokens) — nothing to protect, that's fine.
        if (!(err instanceof Error && /no balance/i.test(err.message))) throw err;
      }
    }

    return NextResponse.json({ holder: getHolder(tokenId, accountId), schedule });
  });
}
