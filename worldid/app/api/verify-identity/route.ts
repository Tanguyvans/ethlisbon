import { worldDebugLog } from "@/lib/world-debug";
import { NextResponse } from "next/server";

type IdentityResponseItem = {
  identifier?: string;
  issuer_schema_id?: number;
  nullifier?: string;
};

type IdentityIDKitResponse = {
  protocol_version?: string;
  action?: string;
  environment?: string;
  identity_attested?: boolean;
  user_presence_completed?: boolean;
  responses?: IdentityResponseItem[];
};

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
      "La preuve d’identité n’a pas été acceptée par World.",
  };
}

export async function POST(request: Request) {
  const rpId = process.env.WORLD_RP_ID;
  const action =
    process.env.WORLD_IDENTITY_ACTION ?? "identity-check-demo";

  if (!rpId) {
    return NextResponse.json(
      { error: "WORLD_RP_ID n’est pas configuré." },
      { status: 503 },
    );
  }

  const idkitResponse = (await request.json()) as IdentityIDKitResponse;
  worldDebugLog(
    "IDENTITY 2/3 Complete IDKit payload received from World ID",
    idkitResponse,
  );

  if (idkitResponse.action !== action) {
    return NextResponse.json(
      {
        error: "La preuve concerne une autre action.",
        code: "action_mismatch",
      },
      { status: 400 },
    );
  }

  if (idkitResponse.environment !== "staging") {
    return NextResponse.json(
      {
        error: "Identity Check doit utiliser le World Simulator staging.",
        code: "identity_environment_mismatch",
        details: `Environnement reçu : ${idkitResponse.environment ?? "absent"}.`,
      },
      { status: 400 },
    );
  }

  if (idkitResponse.protocol_version !== "4.0") {
    return NextResponse.json(
      {
        error:
          "Identity Check nécessite une preuve World ID 4.0 pour attester les attributs.",
        code: "identity_check_requires_v4",
      },
      { status: 400 },
    );
  }

  if (idkitResponse.identity_attested !== true) {
    return NextResponse.json(
      {
        error: "Les attributs d’identité demandés ne correspondent pas.",
        code: "identity_attributes_not_matched",
      },
      { status: 400 },
    );
  }

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

  worldDebugLog(
    "IDENTITY 3/3 Complete World verification API response",
    worldExchange,
  );

  if (!response.ok) {
    const worldError = getWorldError(payload);

    return NextResponse.json(
      {
        error: "World a refusé la preuve d’identité.",
        code: worldError.code,
        details: worldError.detail,
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  if (payload.action && payload.action !== action) {
    return NextResponse.json(
      {
        error: "World a validé une autre action.",
        code: "verified_action_mismatch",
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  const successfulResults =
    payload.results?.filter((result) => result.success) ?? [];
  const documentResult = successfulResults.find((result) =>
    ["passport", "mnc"].includes(result.identifier ?? ""),
  );

  if (!documentResult) {
    return NextResponse.json(
      {
        error:
          "World n’a validé aucun credential NFC compatible avec Identity Check.",
        code: "wrong_identity_credential",
        details: `Reçu : ${
          successfulResults
            .map((result) => result.identifier)
            .filter(Boolean)
            .join(", ") || "aucun"
        }.`,
        ...debugPayload,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    simulated: false,
    world_verified: true,
    identity_attested: true,
    credential: documentResult.identifier,
    nullifier: documentResult.nullifier ?? payload.nullifier,
    checks: [{ type: "minimum_age", operator: ">=", value: 18 }],
    ...debugPayload,
  });
}
