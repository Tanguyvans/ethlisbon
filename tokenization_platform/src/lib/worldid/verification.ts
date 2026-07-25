export type WorldVerificationResponse = {
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

export function getWorldError(payload: WorldVerificationResponse) {
  const failedResult = payload.results?.find((result) => !result.success);
  return {
    code: payload.code ?? failedResult?.code ?? "world_verification_failed",
    details:
      payload.detail ??
      failedResult?.detail ??
      payload.message ??
      "World did not accept the verification proof.",
  };
}

export async function verifyWithWorld(rpId: string, idkitResult: unknown) {
  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResult),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as WorldVerificationResponse;
  return { response, payload };
}
