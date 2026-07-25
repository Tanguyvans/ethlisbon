import { NextResponse } from "next/server";
import {
  getWorldError,
  verifyWithWorld,
} from "@/lib/worldid/verification";

export const runtime = "nodejs";

type IdentityPolicy = "identity-age" | "identity-us";

type IdentityResult = {
  action?: string;
  environment?: string;
  protocol_version?: string;
  identity_attested?: boolean;
};

export async function POST(request: Request) {
  const rpId = process.env.WORLD_RP_ID;
  const action =
    process.env.WORLD_IDENTITY_ACTION ?? "identity-check-demo";

  if (!rpId) {
    return NextResponse.json(
      { error: "WORLD_RP_ID is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { result?: IdentityResult; policy?: IdentityPolicy }
    | null;
  const idkitResult = body?.result;
  const policy = body?.policy;

  if (!idkitResult || !["identity-age", "identity-us"].includes(policy ?? "")) {
    return NextResponse.json(
      { error: "Missing Identity Check result or policy." },
      { status: 400 },
    );
  }

  if (idkitResult.action !== action) {
    return NextResponse.json(
      { error: "This proof belongs to another World ID action.", code: "action_mismatch" },
      { status: 400 },
    );
  }

  if (idkitResult.environment !== "staging") {
    return NextResponse.json(
      {
        error: "Identity Check must run in the staging World Simulator.",
        code: "identity_environment_mismatch",
        details: `Received environment: ${idkitResult.environment ?? "missing"}.`,
      },
      { status: 400 },
    );
  }

  if (idkitResult.protocol_version !== "4.0") {
    return NextResponse.json(
      {
        error: "Identity Check requires a World ID 4.0 proof.",
        code: "identity_check_requires_v4",
      },
      { status: 400 },
    );
  }

  if (idkitResult.identity_attested !== true) {
    return NextResponse.json(
      {
        error: "The requested identity attributes were not matched.",
        code: "identity_attributes_not_matched",
      },
      { status: 400 },
    );
  }

  const { response, payload } = await verifyWithWorld(rpId, idkitResult);
  if (!response.ok) {
    const worldError = getWorldError(payload);
    return NextResponse.json(
      {
        error: "World rejected the Identity Check proof.",
        ...worldError,
      },
      { status: 400 },
    );
  }

  if (payload.action && payload.action !== action) {
    return NextResponse.json(
      { error: "World verified another action.", code: "verified_action_mismatch" },
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
        error: "World verified no compatible NFC identity credential.",
        code: "wrong_identity_credential",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    world_verified: true,
    identity_attested: true,
    credential: documentResult.identifier,
    checks:
      policy === "identity-us"
        ? [
            { type: "minimum_age", operator: ">=", value: 18 },
            { type: "nationality", operator: "=", value: "USA" },
          ]
        : [{ type: "minimum_age", operator: ">=", value: 18 }],
  });
}
