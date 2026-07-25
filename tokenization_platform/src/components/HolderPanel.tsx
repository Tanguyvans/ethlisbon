"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWalletConnect";
import { postJson } from "@/lib/apiClient";
import { Badge, Button, Card, ErrorText, TextInput } from "@/components/ui";
import type { HolderRecord, TokenRecord, TokenRequestRecord } from "@/types";

const OPERATOR_HINT = "the token's treasury account";

export default function HolderPanel({
  token,
  holders,
  requests,
}: {
  token: TokenRecord;
  holders: HolderRecord[];
  requests: TokenRequestRecord[];
}) {
  const { accountId, connect, connecting } = useWallet();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [allowanceAmount, setAllowanceAmount] = useState(token.maxSupply ? Number(token.maxSupply) : 1_000_000_000);

  const holder = useMemo(() => holders.find((h) => h.accountId === accountId) ?? null, [holders, accountId]);
  const tokenRequest = useMemo(
    () => requests.find((request) => request.accountId === accountId) ?? null,
    [requests, accountId]
  );

  useEffect(() => {
    if (
      !tokenRequest ||
      tokenRequest.triggerStatus !== "TRIGGERED" ||
      tokenRequest.processingError ||
      !["PENDING", "PROCESSING"].includes(tokenRequest.status)
    ) {
      return;
    }
    const interval = window.setInterval(() => router.refresh(), 3_000);
    return () => window.clearInterval(interval);
  }, [router, tokenRequest]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (!accountId) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Join as a holder</h2>
        <p className="text-sm text-zinc-500">Connect a Hedera wallet to associate this token, pass compliance checks, and receive a balance.</p>
        <Button onClick={connect} disabled={connecting} className="self-start">
          {connecting ? "Connecting…" : "Connect wallet"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Your wallet — {accountId}</h2>
        {holder && <StatusBadge status={holder.status} />}
      </div>

      {!holder && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">You haven&apos;t registered for this token yet.</p>
          <Button
            className="self-start"
            disabled={busy === "register"}
            onClick={() => run("register", () => postJson(`/api/tokens/${token.id}/holders`, { accountId }))}
          >
            {busy === "register" ? "Registering…" : "Join this token"}
          </Button>
        </div>
      )}

      {holder && (
        <div className="flex flex-col gap-3">
          <ChecklistRow
            label="Associate token to your account"
            done={holder.associated}
            action={
              <AssociateButton tokenId={token.id} accountId={accountId} onDone={() => router.refresh()} onError={setError} />
            }
          />
          {token.tokenType === "FUNGIBLE" && (
            <ChecklistRow
              label={`Request 1 ${token.symbol}`}
              done={tokenRequest?.status === "FULFILLED"}
              extra={<TokenRequestSummary request={tokenRequest} />}
              action={
                <TokenRequestAction
                  request={tokenRequest}
                  disabled={!holder.associated || token.paused}
                  busy={busy === "token-request"}
                  onRequest={() =>
                    run("token-request", async () => {
                      const result = await postJson<{
                        triggered: boolean;
                        warning?: string;
                      }>(`/api/tokens/${token.id}/requests`, { accountId });
                      if (!result.triggered && result.warning) {
                        setNotice(`Request saved. Hermes could not start yet: ${result.warning}`);
                      }
                    })
                  }
                />
              }
            />
          )}
          {token.compliance.worldIdRequired && (
            <ChecklistRow
              label="Verify with World ID (stubbed)"
              done={!!holder.worldIdVerifiedAt}
              action={
                <Button
                  variant="secondary"
                  disabled={busy === "worldid" || !!holder.worldIdVerifiedAt}
                  onClick={() => run("worldid", () => postJson(`/api/tokens/${token.id}/holders/${accountId}/worldid-verify`))}
                >
                  {busy === "worldid" ? "Verifying…" : holder.worldIdVerifiedAt ? "Verified" : "Verify"}
                </Button>
              }
            />
          )}
          {token.compliance.livenessEnabled && (
            <ChecklistRow
              label={`Approve reclaim allowance to ${OPERATOR_HINT}`}
              done={holder.allowanceGranted}
              action={
                holder.allowanceGranted ? (
                  <Badge tone="emerald">Granted</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <TextInput
                      type="number"
                      className="w-32"
                      value={allowanceAmount}
                      onChange={(e) => setAllowanceAmount(Number(e.target.value))}
                    />
                    <AllowanceButton
                      tokenId={token.id}
                      accountId={accountId}
                      treasuryAccountId={token.treasuryAccountId}
                      amount={allowanceAmount}
                      onDone={() => router.refresh()}
                      onError={setError}
                    />
                  </div>
                )
              }
            />
          )}
          {token.compliance.livenessEnabled && holder.allowanceGranted && (
            <ChecklistRow
              label="Liveness check-in"
              done={false}
              extra={<LivenessSummary holder={holder} periodSeconds={token.compliance.livenessPeriodSeconds} />}
              action={
                <Button
                  disabled={busy === "checkin"}
                  onClick={() => run("checkin", () => postJson(`/api/tokens/${token.id}/holders/${accountId}/checkin`))}
                >
                  {busy === "checkin" ? "Checking in…" : "Check in now"}
                </Button>
              }
            />
          )}
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      {notice && <p className="text-sm text-amber-700 dark:text-amber-300">{notice}</p>}
    </Card>
  );
}

function TokenRequestAction({
  request,
  disabled,
  busy,
  onRequest,
}: {
  request: TokenRequestRecord | null;
  disabled: boolean;
  busy: boolean;
  onRequest: () => void;
}) {
  if (request?.status === "FULFILLED") {
    return request.fulfillmentHashscanUrl ? (
      <a
        href={request.fulfillmentHashscanUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
      >
        View transfer ↗
      </a>
    ) : (
      <Badge tone="emerald">Sent</Badge>
    );
  }
  if (request?.status === "REJECTED") {
    return (
      <Button variant="secondary" disabled={disabled || busy} onClick={onRequest}>
        {busy ? "Requesting…" : "Request again"}
      </Button>
    );
  }
  if (request?.status === "PROCESSING") {
    return request.processingError ? (
      <Badge tone="red">Review needed</Badge>
    ) : (
      <Badge tone="violet">Hermes sending</Badge>
    );
  }
  if (request?.status === "PENDING" && request.triggerStatus === "TRIGGERED") {
    return (
      <Button variant="secondary" disabled={disabled || busy} onClick={onRequest}>
        {busy ? "Triggering…" : "Retry Hermes"}
      </Button>
    );
  }

  return (
    <Button disabled={disabled || busy} onClick={onRequest}>
      {busy ? "Requesting…" : request?.triggerStatus === "FAILED" ? "Retry Hermes" : "Request"}
    </Button>
  );
}

function TokenRequestSummary({ request }: { request: TokenRequestRecord | null }) {
  if (!request) return <span className="text-xs text-zinc-500">Hermes reviews and sends from treasury.</span>;
  if (request.status === "FULFILLED") {
    return <span className="text-xs text-emerald-700 dark:text-emerald-300">1 token sent.</span>;
  }
  if (request.status === "REJECTED") {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">
        {request.rejectionReason ?? "Hermes rejected this request."}
      </span>
    );
  }
  if (request.status === "PROCESSING") {
    if (request.processingError) {
      return (
        <span className="text-xs text-red-600 dark:text-red-400">
          Transfer result is uncertain; operator review required.
        </span>
      );
    }
    return <span className="text-xs text-violet-600 dark:text-violet-300">Transfer in progress…</span>;
  }
  if (request.processingError) {
    return (
      <span className="text-xs text-amber-700 dark:text-amber-300">
        Last on-chain attempt failed safely; retry Hermes.
      </span>
    );
  }
  if (request.triggerStatus === "FAILED") {
    return <span className="text-xs text-amber-700 dark:text-amber-300">Saved; Hermes needs a retry.</span>;
  }
  return <span className="text-xs text-zinc-500">Hermes is reviewing the request…</span>;
}

function ChecklistRow({
  label,
  done,
  action,
  extra,
}: {
  label: string;
  done: boolean;
  action: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-3 first:border-none first:pt-0">
      <div className="flex flex-col">
        <span className="text-sm flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`} />
          {label}
        </span>
        {extra}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: HolderRecord["status"] }) {
  if (status === "WHITELISTED") return <Badge tone="emerald">Whitelisted</Badge>;
  if (status === "REVOKED") return <Badge tone="red">Revoked</Badge>;
  return <Badge tone="amber">Pending review</Badge>;
}

function LivenessSummary({ holder, periodSeconds }: { holder: HolderRecord; periodSeconds?: number }) {
  if (!holder.lastCheckinAt) return <span className="text-xs text-zinc-500">Never checked in</span>;
  const last = new Date(holder.lastCheckinAt).toLocaleString();
  const expires = holder.activeScheduleExpiresAt ? new Date(holder.activeScheduleExpiresAt).toLocaleString() : null;
  return (
    <span className="text-xs text-zinc-500">
      Last check-in {last}
      {expires && ` · auto-reclaim scheduled ${expires} if you don't check in again`}
      {periodSeconds && !expires && ` · period ${Math.round(periodSeconds / 60)} min`}
    </span>
  );
}

function AssociateButton({
  tokenId,
  accountId,
  onDone,
  onError,
}: {
  tokenId: string;
  accountId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { associateToken } = useWallet();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        onError("");
        try {
          const txId = await associateToken(tokenId);
          await postJson(`/api/tokens/${tokenId}/holders/${accountId}/associate`, { txId });
          onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : "Association failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Associating…" : "Associate"}
    </Button>
  );
}

function AllowanceButton({
  tokenId,
  accountId,
  treasuryAccountId,
  amount,
  onDone,
  onError,
}: {
  tokenId: string;
  accountId: string;
  treasuryAccountId: string;
  amount: number;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { approveAllowance } = useWallet();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy || amount <= 0}
      onClick={async () => {
        setBusy(true);
        onError("");
        try {
          const txId = await approveAllowance(tokenId, treasuryAccountId, amount);
          await postJson(`/api/tokens/${tokenId}/holders/${accountId}/allowance`, { txId });
          onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : "Allowance approval failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Approving…" : "Approve"}
    </Button>
  );
}
