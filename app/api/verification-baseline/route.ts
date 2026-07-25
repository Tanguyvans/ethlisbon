import {
  clearContinuityBaseline,
  hasContinuityBaseline,
} from "@/lib/continuity-store";
import { NextResponse } from "next/server";

function getScope() {
  const rpId = process.env.WORLD_RP_ID;
  const action = process.env.WORLD_ACTION ?? "selfie-check-demo";

  if (!rpId) {
    return null;
  }

  return { rpId, action };
}

export async function GET() {
  const scope = getScope();

  if (!scope) {
    return NextResponse.json(
      { error: "WORLD_RP_ID n’est pas configuré." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    has_baseline: await hasContinuityBaseline(scope),
  });
}

export async function DELETE() {
  await clearContinuityBaseline();
  return NextResponse.json({ success: true });
}
