import { NextResponse } from "next/server";
import {
  getWorldError,
  verifyWithWorld,
} from "@/lib/worldid/verification";

export const runtime = "nodejs";

type SelfieResult = {
  action?: string;
  environment?: string;
  protocol_version?: string;
  user_presence_completed?: boolean;
};

export async function POST(request: Request) {
  const rpId = process.env.WORLD_RP_ID;
  const action = process.env.WORLD_ACTION ?? "selfie-check-demo";

  if (!rpId) {
    return NextResponse.json(
      { error: "WORLD_RP_ID is not configured." },
      { status: 503 },
    );
  }

  const idkitResult = (await request.json().catch(() => null)) as
    | SelfieResult
    | null;

  if (!idkitResult) {
    return NextResponse.json(
      { error: "Missing IDKit Selfie Check result." },
      { status: 400 },
    );
  }

  if (idkitResult.environment !== "production") {
    return NextResponse.json(
      {
        error: "Selfie Check must run in the production World App.",
        code: "selfie_environment_mismatch",
        details: `Received environment: ${idkitResult.environment ?? "missing"}.`,
      },
      { status: 400 },
    );
  }

  if (idkitResult.user_presence_completed !== true) {
    return NextResponse.json(
      {
        error: "World did not confirm fresh user presence.",
        code: "user_presence_required",
      },
      { status: 400 },
    );
  }

  if (idkitResult.action && idkitResult.action !== action) {
    return NextResponse.json(
      { error: "This proof belongs to another World ID action.", code: "action_mismatch" },
      { status: 400 },
    );
  }

  const { response, payload } = await verifyWithWorld(rpId, idkitResult);
  if (!response.ok) {
    const worldError = getWorldError(payload);
    return NextResponse.json(
      {
        error: "World rejected the Selfie Check proof.",
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
  const selfieResult = successfulResults.find((result) =>
    ["face", "selfie"].includes(result.identifier ?? ""),
  );

  if (!selfieResult) {
    return NextResponse.json(
      {
        error: "World verified the proof without a Selfie Check credential.",
        code: "wrong_credential",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    world_verified: true,
    check: "selfie",
  });
}
