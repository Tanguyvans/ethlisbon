import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { getHolder, insertEvent, updateHolder } from "@/lib/db/repo";
import { worldIdHolderSignal } from "@/lib/worldid/policy";
import {
  verifyIdentityCredential,
  verifySelfieCredential,
  WorldProofError,
} from "@/lib/worldid/verification";

export const dynamic = "force-dynamic";

type VerificationBody = {
  check?: "selfie" | "identity";
  result?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    const token = requireToken(tokenId);
    const holder = getHolder(tokenId, accountId);
    if (!holder) throw new ApiError("Join this token before verifying with World ID.", 404);
    if (!holder.associated) {
      throw new ApiError("Associate this token with your wallet before World ID verification.", 409);
    }

    const { check, result } = await readJson<VerificationBody>(req);
    if (!check || !result) throw new ApiError("Missing World ID proof.", 400);

    const identityRequired =
      token.compliance.worldIdMinimumAge != null ||
      token.compliance.worldIdNationality != null;
    if (check === "selfie" && !token.compliance.worldIdSelfieCheck) {
      throw new ApiError("This token does not require Selfie Check.", 409);
    }
    if (check === "identity" && !identityRequired) {
      throw new ApiError("This token does not require Identity Check.", 409);
    }

    const signal = worldIdHolderSignal(tokenId, accountId);
    let verification: { nullifier: string; credential: string };
    try {
      verification =
        check === "selfie"
          ? await verifySelfieCredential(result, signal)
          : await verifyIdentityCredential(result, signal);
    } catch (error) {
      if (error instanceof WorldProofError) {
        throw new ApiError(
          [error.message, error.code, error.details].filter(Boolean).join(" · "),
          error.status
        );
      }
      throw error;
    }

    const verifiedAt = new Date().toISOString();
    const selfieVerifiedAt =
      check === "selfie" ? verifiedAt : holder.worldIdSelfieVerifiedAt;
    const identityVerifiedAt =
      check === "identity" ? verifiedAt : holder.worldIdIdentityVerifiedAt;
    const allRequiredChecksPassed =
      (!token.compliance.worldIdSelfieCheck || !!selfieVerifiedAt) &&
      (!identityRequired || !!identityVerifiedAt);

    updateHolder(tokenId, accountId, {
      worldIdSelfieVerifiedAt: selfieVerifiedAt,
      worldIdIdentityVerifiedAt: identityVerifiedAt,
      worldIdVerifiedAt: allRequiredChecksPassed ? verifiedAt : null,
    });
    insertEvent({
      tokenId,
      accountId,
      type: "WORLDID_VERIFY",
      detail: {
        check,
        credential: verification.credential,
        provider: "World ID",
        nullifierHash: createHash("sha256").update(verification.nullifier).digest("hex"),
      },
    });

    return NextResponse.json({
      success: true,
      check,
      verifiedAt,
      allRequiredChecksPassed,
      holder: getHolder(tokenId, accountId),
    });
  });
}
