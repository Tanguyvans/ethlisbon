import { NextResponse } from "next/server";

function isMockEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.IDENTITY_CHECK_MOCK !== "false"
  );
}

export async function POST(request: Request) {
  if (!isMockEnabled()) {
    return NextResponse.json(
      {
        error: "La simulation Identity Check est désactivée.",
        code: "mock_disabled",
      },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    outcome?: "accepted" | "rejected";
  };
  const accepted = body.outcome !== "rejected";
  const status = accepted ? 200 : 422;
  const mockWorldBody = accepted
    ? {
        success: true,
        simulated: true,
        results: [
          {
            identifier: "passport",
            success: true,
            nullifier: "mock_nullifier_not_cryptographic",
          },
        ],
        action: "identity-check-demo",
        message: "Simulated identity attributes matched",
      }
    : {
        success: false,
        simulated: true,
        code: "identity_attributes_not_matched",
        detail: "Simulated identity attributes did not match.",
      };

  return NextResponse.json(
    {
      success: accepted,
      simulated: true,
      world_verified: false,
      identity_attested: accepted,
      credential: "passport",
      checks: [
        {
          type: "minimum_age",
          operator: ">=",
          value: 18,
          matched: accepted,
        },
      ],
      error: accepted
        ? undefined
        : "Simulation : les attributs d’identité ne correspondent pas.",
      code: accepted ? undefined : "identity_attributes_not_matched",
      debug: {
        world_exchange: {
          endpoint: "mock://identity-check",
          http_status: status,
          http_status_text: accepted
            ? "SIMULATED ACCEPTED"
            : "SIMULATED REJECTED",
          body: mockWorldBody,
        },
      },
    },
    { status },
  );
}
