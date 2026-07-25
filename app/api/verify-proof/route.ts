import { assessContinuity } from "@/lib/continuity-store";
import { worldDebugLog } from "@/lib/world-debug";
import { NextResponse } from "next/server";

type WorldVerificationResponse = {
  success?: boolean;
  action?: string;
  nullifier?: string;
  code?: string;
  detail?: string;
  message?: string;
  results?: Array<{
    identifier?: string;
    success?: boolean;
    nullifier?: string;
    code?: string;
    detail?: string;
  }>;
};

function getWorldError(payload: WorldVerificationResponse) {
  const failedResult = payload.results?.find((result) => !result.success);

  return {
    code: payload.code ?? failedResult?.code ?? "world_verification_failed",
    detail:
      payload.detail ??
      failedResult?.detail ??
      payload.message ??
      "La preuve n’a pas été acceptée par World.",
  };
}

export async function POST(request: Request) {
  const rpId = process.env.WORLD_RP_ID;
  const action = process.env.WORLD_ACTION ?? "selfie-check-demo";

  if (!rpId) {
    return NextResponse.json(
      { error: "WORLD_RP_ID n’est pas configuré." },
      { status: 503 },
    );
  }

  const idkitResponse = (await request.json()) as {
    user_presence_completed?: boolean;
  };
  worldDebugLog("2/3 Complete IDKit payload received from World ID", idkitResponse);

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResponse),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as WorldVerificationResponse;

  const worldExchange = {
    endpoint: `https://developer.world.org/api/v4/verify/${rpId}`,
    http_status: response.status,
    http_status_text: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: payload,
  };
  const debugPayload =
    process.env.NODE_ENV === "production"
      ? {}
      : { debug: { world_exchange: worldExchange } };

  worldDebugLog("3/3 Complete World verification API response", worldExchange);

  if (!response.ok) {
    const worldError = getWorldError(payload);

    return NextResponse.json(
      {
        error: "World a refusé la preuve.",
        code: worldError.code,
        details: worldError.detail,
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  if (idkitResponse.user_presence_completed !== true) {
    return NextResponse.json(
      {
        error: "World n’a pas confirmé une présence utilisateur fraîche.",
        code: "user_presence_required",
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  if (payload.action && payload.action !== action) {
    return NextResponse.json(
      {
        error: "La preuve concerne une autre action.",
        code: "action_mismatch",
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  const successfulResults =
    payload.results?.filter((result) => result.success) ?? [];
  const faceResult = successfulResults.find(
    (result) => result.identifier === "face",
  );

  if (!faceResult && successfulResults.length > 0) {
    const receivedCredentials = successfulResults
      .map((result) => result.identifier)
      .filter(Boolean)
      .join(", ");

    return NextResponse.json(
      {
        error: "La preuve vérifiée n’est pas un Selfie Check.",
        code: "wrong_credential",
        details: `Credential attendu : face. Reçu : ${receivedCredentials || "inconnu"}.`,
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  const nullifier = faceResult?.nullifier;

  if (!nullifier) {
    return NextResponse.json(
      {
        error: "World a validé la preuve sans retourner de nullifier.",
        code: "missing_nullifier",
        ...debugPayload,
      },
      { status: 502 },
    );
  }

  const continuity = await assessContinuity({
    rpId,
    action,
    nullifier,
  });

  if (continuity.continuity === "different_person") {
    return NextResponse.json(
      {
        success: false,
        continuity: continuity.continuity,
        enrolled_at: continuity.enrolledAt,
        error: "Cette preuve appartient à une autre personne.",
        ...debugPayload,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    continuity: continuity.continuity,
    enrolled_at: continuity.enrolledAt,
    ...debugPayload,
  });
}
