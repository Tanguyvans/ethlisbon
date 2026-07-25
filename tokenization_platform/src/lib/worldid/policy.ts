import type { HolderRecord, TokenRecord } from "@/types";

export function worldIdHolderSignal(tokenId: string, accountId: string): string {
  return `hedera:${tokenId}:holder:${accountId}`;
}

export function hasRequiredWorldIdVerification(
  token: TokenRecord,
  holder: HolderRecord | null
): boolean {
  if (!token.compliance.worldIdRequired) return true;
  if (!holder) return false;

  if (
    token.compliance.worldIdSelfieCheck &&
    !holder.worldIdSelfieVerifiedAt
  ) {
    return false;
  }

  const identityRequired =
    token.compliance.worldIdMinimumAge != null ||
    token.compliance.worldIdNationality != null;
  if (identityRequired && !holder.worldIdIdentityVerifiedAt) return false;

  return true;
}
