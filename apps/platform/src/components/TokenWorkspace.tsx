"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import HolderPanel from "@/components/HolderPanel";
import TokenChat from "@/components/TokenChat";
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
    <div className="token-workspace">
      <Link href="/" className="token-back-link">
        <span aria-hidden="true">←</span>
        All tokens
      </Link>
      <TokenHeader token={token} />
      <HolderPanel
        token={token}
        holders={holders}
        requests={requests}
        worldConfig={worldConfig}
      />
      <TokenChat token={token} holders={holders} />
      <EventLog events={events} />
    </div>
  );
}

function TokenHeader({ token }: { token: TokenRecord }) {
  return (
    <Card className="token-header-card flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="token-header-symbol">{token.symbol}</span>
          <h1 className="text-2xl font-semibold">{token.name}</h1>
          {token.paused && <Badge tone="red">PAUSED</Badge>}
        </div>
        <div className="text-sm text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
          <span className="font-mono">{token.id}</span>
          <span>·</span>
          <span>{token.tokenType}</span>
          <Badge tone={token.blockchain === "EVM" ? "violet" : "emerald"}>
            {token.blockchain === "EVM" ? "Ethereum Sepolia" : "Hedera testnet"}
          </Badge>
          <a href={token.explorerUrl} target="_blank" rel="noreferrer" className="hover:underline">
            {token.explorerName} ↗
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {token.compliance.kycRequired && <Badge>KYC required</Badge>}
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
