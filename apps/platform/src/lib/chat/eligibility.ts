import { getEvmTokenBalance } from "@/lib/evm/client";
import { getTokenBalanceBaseUnits } from "@/lib/hedera/tokenService";
import type { TokenRecord } from "@/types";

/**
 * Live on-chain balance check — the actual "does this wallet currently hold
 * this token" gate for chat, shared by the GET eligibility check (UI state)
 * and the POST chat route (enforcement). Deliberately NOT the local
 * `holders` bookkeeping row: that only reflects "registered", not a current
 * positive balance (e.g. requested-but-not-fulfilled, or since reclaimed).
 */
export async function hasPositiveBalance(token: TokenRecord, accountId: string): Promise<boolean> {
  const balance =
    token.blockchain === "EVM"
      ? await getEvmTokenBalance(token.id, accountId)
      : await getTokenBalanceBaseUnits(token.id, accountId);
  return balance > BigInt(0);
}
