import { signRequest } from "@worldcoin/idkit/signing";
import { worldDebugLog } from "@/lib/world-debug";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const signingKey = process.env.WORLD_RP_SIGNING_KEY;
  const rpId = process.env.WORLD_RP_ID;
  const action = process.env.WORLD_ACTION ?? "selfie-check-demo";

  if (!signingKey || !rpId) {
    return NextResponse.json(
      {
        error:
          "Configuration World manquante : WORLD_RP_ID ou WORLD_RP_SIGNING_KEY.",
      },
      { status: 503 },
    );
  }

  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: signingKey,
      action,
    });

    const rpContext = {
      rp_id: rpId,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
      action,
    };

    worldDebugLog("1/3 Request configuration and RP context", {
      request: {
        app_id: process.env.NEXT_PUBLIC_WORLD_APP_ID,
        rp_id: rpId,
        action,
        environment:
          process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT ?? "staging",
        credential_preset: "SelfieCheckLegacy",
        allow_legacy_proofs: true,
        signal:
          process.env.NEXT_PUBLIC_WORLD_SIGNAL ?? "selfie-demo-user",
      },
      rp_context: rpContext,
      excluded: ["WORLD_RP_SIGNING_KEY"],
    });

    return NextResponse.json(rpContext);
  } catch {
    return NextResponse.json(
      { error: "La clé RP n’a pas permis de signer la demande." },
      { status: 500 },
    );
  }
}
