# Tokenization Platform (Hedera Token Service)

A frontend + backend for issuing real-world-asset tokens on **Hedera Token Service (HTS)** with
compliance controls picked as checkboxes at creation time — KYC, freeze-gating, wipe/clawback,
pause, and (partially stubbed) World ID-gated whitelisting with liveness-based auto-reclaim.

Built for the ETHGlobal Lisbon 2026 Hedera track ("Tokenization on Hedera" + "No Solidity
Allowed" — everything here is native HTS/Schedule Service via the Hedera SDK, no smart
contracts).

## Why HTS instead of an ERC-20 contract

Every compliance primitive this app needs — KYC, freeze, wipe, pause, custom fees — is a
**native token key/feature** on Hedera, enforced by consensus nodes, not application code. That
means:

- Compliance can't be bypassed by calling the token contract directly — there is no contract.
- The Hedera network itself rejects a non-compliant transfer even if this app's local database
  is stale or wrong (see the comment in `POST /api/tokens/[id]/transfer`).

## Architecture

Single Next.js 16 app (App Router, TypeScript, Tailwind). No separate backend process.
In the integrated deployment it is built as a standalone Node server under the
`/tokenization` base path and exposed through Hermes's authenticated reverse proxy.

```
src/
  app/
    page.tsx                     dashboard (server component, reads SQLite directly)
    create/page.tsx              token creation form
    tokens/[tokenId]/page.tsx    token workspace (holder self-service + admin panel)
    api/tokens/...               REST route handlers (operator-signed Hedera actions)
  components/                    React UI
  hooks/useWalletConnect.tsx     WalletConnect (HashPack etc.) client-side wallet state
  lib/
    hedera/
      client.ts                 operator/treasury Client singleton
      tokenService.ts           TokenCreate/GrantKyc/Freeze/Wipe/Pause/Transfer
      scheduleService.ts        long-term Scheduled Transactions for auto-reclaim
      format.ts                 HashScan link helpers
    db/                         better-sqlite3 (schema in schema.ts, queries in repo.ts)
    walletconnect/connector.ts  browser DAppConnector singleton
    worldid/mock.ts             STUBBED World ID verification (see below)
    validation.ts               zod schemas for every API route
  types/index.ts                shared domain types
```

**SDK note:** this project uses `@hiero-ledger/sdk`, not `@hashgraph/sdk`. The WalletConnect
integration (`@hashgraph/hedera-wallet-connect`) is built against `@hiero-ledger/sdk`
specifically — mixing it with `@hashgraph/sdk` would create two incompatible copies of every
SDK class (`AccountId`, `Transaction`, ...). `@hiero-ledger/sdk` is a full drop-in with the same
API surface. Similarly, wallet connection uses `@hashgraph/hedera-wallet-connect`'s legacy
`DAppConnector` rather than full Reown AppKit — `hashconnect` (the older HashPack-specific
library) prints its own deprecation notice ("will be shut down by 2026"), so it was avoided.

## Compliance checkboxes → HTS features

| Checkbox (create-token form)          | HTS mechanism                                             |
| -------------------------------------- | ----------------------------------------------------------- |
| Require KYC approval                   | `kycKey` set; admin `TokenGrantKycTransaction` per account   |
| Freeze new accounts by default         | `freezeKey` + `freezeDefault=true`; admin unfreezes on approval |
| Enable wipe / clawback                 | `wipeKey`; admin `TokenWipeTransaction` (immediate reclaim)  |
| Enable pause                           | `pauseKey`; admin `TokenPauseTransaction`                    |
| Custom fee                             | `feeScheduleKey` + `CustomFixedFee` / `CustomFractionalFee` / `CustomRoyaltyFee` |
| Require World ID before whitelisting   | Off-chain gate (see **World ID stub** below) on top of KYC/freeze |
| Liveness check-ins & auto-reclaim      | Holder-granted token allowance + long-term **Scheduled Transaction** (see below) |

Whitelisting an address = granting KYC and/or unfreezing it, whichever mechanism(s) the token
was created with. Both are real, independent HTS controls — a token can require either, both,
or neither.

## Liveness / auto-reclaim mechanism

This is the "if the person hasn't checked in for X time, tokens can be reclaimed" feature.

1. A holder who wants to receive a liveness-gated token approves a **token allowance** to the
   treasury (`AccountAllowanceApproveTransaction`, signed by their own wallet). This lets the
   treasury move tokens *out* of the holder's account later without needing another signature.
2. On check-in (or first receiving an allowance), the backend creates a **long-term Hedera
   Scheduled Transaction** — [HIP-423](https://hips.hedera.com/hip/hip-423): a
   `TransferTransaction` (using the approved allowance) wrapped in `ScheduleCreateTransaction`
   with `setExpirationTime(...)` + `setWaitForExpiry(true)`. The operator's signature (as the
   spender) is attached at creation time, so the network just waits and auto-executes the
   reclaim at the expiry — **no cron job or bot required**.
3. Checking in again cancels the pending schedule (`ScheduleDeleteTransaction`) and creates a
   fresh one further out.

Caveats (documented in code comments too):
- A scheduled transaction's amount is fixed at creation time — it captures the holder's
  *current* balance. Receiving more tokens without checking in again won't be covered by an
  already-scheduled reclaim.
- Hedera caps how far in the future a schedule's expiry can be — pick a demo-friendly period
  (minutes) rather than a realistic one (months) if you want to actually see it fire live.

## World ID stub

`src/lib/worldid/mock.ts` always "verifies" successfully — the product brief explicitly deferred
real World ID integration. Every caller only depends on `verifyWorldId(accountId)`'s signature,
so swapping in a real [IDKit](https://docs.world.org/world-id) `verifyCloudProof()` call is a
one-file change. The rest of the pipeline (the `worldIdRequired` checkbox, gating the whitelist
endpoint on `worldIdVerifiedAt`, the UI badge, the event log entry) is fully wired up today.

## Setup

1. **Get a Hedera testnet account** (operator/treasury for every token this app creates):
   [portal.hedera.com](https://portal.hedera.com) or hashscan.io → Connect Wallet → Create
   account. You need the Account ID (`0.0.x`) and its DER-encoded private key.
2. **Get a free Reown/WalletConnect project ID** at [cloud.reown.com](https://cloud.reown.com) —
   needed for the "Connect wallet" flow (HashPack, Kabila, etc.). Set it as
   `WALLETCONNECT_PROJECT_ID`; the app exposes this public identifier to the browser at runtime.
3. Copy the env file and fill it in:
   ```bash
   cp .env.example .env
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:3000/tokenization, create a token, then open it in a second browser (or incognito
   window) with a *different* funded testnet account connected to act as the holder.

## Known simplifications (hackathon scope)

- **Single operator key** backs every token's admin/kyc/freeze/wipe/pause/supply/fee-schedule
  key, and is also the treasury. A production version would generate per-token keys and move
  signing behind an HSM/KMS.
- **No native request authentication** on the admin/holder API routes. The integrated container
  mitigates this by binding Next.js to loopback and protecting every `/tokenization/*` request
  with the Hermes session. Direct standalone deployment still needs session/signature-based
  authorization before it can be exposed publicly.
- **NFT tokens** can be created (all the same compliance keys apply), but minting individual
  serials / per-serial transfer management isn't built — the workspace UI shows a placeholder
  for non-fungible tokens on the distribute/reclaim panels.
- **Association & allowance verification**: association is confirmed server-side via an
  `AccountBalanceQuery` before being trusted; allowance approval is currently trusted from the
  client-reported transaction id. A production build should also verify allowances via the
  mirror node's `/accounts/{id}/allowances/tokens` endpoint.
- Amounts throughout the API/UI are in the token's **base units** (respecting whatever
  `decimals` it was created with), not decimal-adjusted display units.
