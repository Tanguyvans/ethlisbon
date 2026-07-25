import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type StoredBaseline = {
  version: 1;
  scope_digest: string;
  nullifier_digest: string;
  enrolled_at: string;
};

export type ContinuityResult =
  | {
      continuity: "enrolled";
      enrolledAt: string;
    }
  | {
      continuity: "same_person";
      enrolledAt: string;
    }
  | {
      continuity: "different_person";
      enrolledAt: string;
    };

const dataDirectory = path.join(process.cwd(), ".data");
const baselinePath = path.join(dataDirectory, "selfie-baseline.json");

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function getScopeDigest(rpId: string, action: string) {
  return digest(`${rpId}:${action}:face`);
}

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function readBaseline(): Promise<StoredBaseline | null> {
  try {
    const content = await readFile(baselinePath, "utf8");
    const baseline = JSON.parse(content) as StoredBaseline;

    if (
      baseline.version !== 1 ||
      !baseline.scope_digest ||
      !baseline.nullifier_digest ||
      !baseline.enrolled_at
    ) {
      throw new Error("Invalid continuity baseline.");
    }

    return baseline;
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }

    throw error;
  }
}

async function writeBaseline(baseline: StoredBaseline) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${baselinePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(baseline, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, baselinePath);
}

export async function assessContinuity({
  rpId,
  action,
  nullifier,
}: {
  rpId: string;
  action: string;
  nullifier: string;
}): Promise<ContinuityResult> {
  const scopeDigest = getScopeDigest(rpId, action);
  const nullifierDigest = digest(nullifier);
  const baseline = await readBaseline();

  if (!baseline || baseline.scope_digest !== scopeDigest) {
    const enrolledAt = new Date().toISOString();
    await writeBaseline({
      version: 1,
      scope_digest: scopeDigest,
      nullifier_digest: nullifierDigest,
      enrolled_at: enrolledAt,
    });

    return { continuity: "enrolled", enrolledAt };
  }

  if (baseline.nullifier_digest === nullifierDigest) {
    return {
      continuity: "same_person",
      enrolledAt: baseline.enrolled_at,
    };
  }

  return {
    continuity: "different_person",
    enrolledAt: baseline.enrolled_at,
  };
}

export async function hasContinuityBaseline({
  rpId,
  action,
}: {
  rpId: string;
  action: string;
}) {
  const baseline = await readBaseline();
  return baseline?.scope_digest === getScopeDigest(rpId, action);
}

export async function clearContinuityBaseline() {
  try {
    await unlink(baselinePath);
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
  }
}
