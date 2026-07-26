"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/apiClient";
import { Badge, Button, Card } from "@/components/ui";
import HolderPanel from "@/components/HolderPanel";
import HolderTable from "@/components/HolderTable";
import DistributeForm from "@/components/DistributeForm";
import EventLog from "@/components/EventLog";
import type {
  EventRecord,
  HolderRecord,
  TokenRecord,
  TokenRequestRecord,
  WorldIdClientConfig,
} from "@/types";

export default function TokenWorkspace({
  token,
  holders,
  events,
  requests,
  worldConfig,
}: {
  token: TokenRecord;
  holders: HolderRecord[];
  events: EventRecord[];
  requests: TokenRequestRecord[];
  worldConfig: WorldIdClientConfig;
}) {
  return (
    <div className="flex flex-col gap-6">
      <TokenHeader token={token} />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <HolderPanel
          token={token}
          holders={holders}
          requests={requests}
          worldConfig={worldConfig}
        />
        <DistributeForm token={token} holders={holders} />
      </div>
      <HolderTable token={token} holders={holders} />
      <EventLog events={events} />
    </div>
  );
}

function TokenHeader({ token }: { token: TokenRecord }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{token.name}</h1>
            <span className="text-zinc-500">{token.symbol}</span>
            {token.paused && <Badge tone="red">PAUSED</Badge>}
          </div>
          <div className="text-sm text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{token.id}</span>
            <span>·</span>
            <span>{token.tokenType}</span>
            <span>·</span>
            <span>treasury {token.treasuryAccountId}</span>
            <Badge tone={token.blockchain === "EVM" ? "violet" : "emerald"}>
              {token.blockchain === "EVM" ? "Ethereum Sepolia" : "Hedera testnet"}
            </Badge>
            <a href={token.explorerUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {token.explorerName} ↗
            </a>
          </div>
        </div>
        {token.keys.pause && (
          <Button
            variant={token.paused ? "primary" : "secondary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await postJson(`/api/tokens/${token.id}/pause`, { paused: !token.paused });
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to toggle pause");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : token.paused ? "Unpause token" : "Pause token"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {token.compliance.kycRequired && <Badge>KYC key</Badge>}
        {token.compliance.freezeDefault && <Badge>Freeze key</Badge>}
        {token.compliance.wipeEnabled && <Badge>Wipe key</Badge>}
        {token.compliance.pauseEnabled && <Badge>Pause key</Badge>}
        {token.customFee && <Badge>Custom fee</Badge>}
        {token.compliance.worldIdSelfieCheck && <Badge tone="violet">Selfie Check</Badge>}
        {token.compliance.worldIdMinimumAge && (
          <Badge tone="violet">Age {token.compliance.worldIdMinimumAge}+</Badge>
        )}
        {token.compliance.worldIdNationality && (
          <Badge tone="violet">Nationality {token.compliance.worldIdNationality}</Badge>
        )}
        {token.compliance.livenessEnabled && (
          <Badge tone="amber">
            Liveness · reclaim after {formatPeriod(token.compliance.livenessPeriodSeconds)}
          </Badge>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function formatPeriod(seconds?: number): string {
  if (!seconds) return "?";
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}
