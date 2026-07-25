import { NextResponse } from "next/server";
import { handleRoute, requireToken } from "@/lib/api/helpers";
import { insertEvent, updateHolder } from "@/lib/db/repo";
import { verifyWorldId } from "@/lib/worldid/mock";

export const dynamic = "force-dynamic";

/** STUBBED World ID verification — see lib/worldid/mock.ts. Always succeeds for now so the
 *  rest of the compliance flow (gating whitelist approval on this) is fully wired up. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    requireToken(tokenId);

    const result = await verifyWorldId(accountId);
    updateHolder(tokenId, accountId, { worldIdVerifiedAt: result.verifiedAt });
    insertEvent({
      tokenId,
      accountId,
      type: "WORLDID_VERIFY",
      detail: { nullifierHash: result.nullifierHash, note: result.note },
    });

    return NextResponse.json(result);
  });
}
