import Link from "next/link";
import { listTokens } from "@/lib/db/repo";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  securities: "Securities",
  "real-estate": "Real estate",
  invoices: "Invoices",
  "carbon-credits": "Carbon credits",
  commodities: "Commodities",
  other: "Other",
};

export default function DashboardPage() {
  const tokens = listTokens();

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
        <h1 className="text-2xl font-semibold">No tokens yet</h1>
        <p className="text-zinc-500 max-w-md">
          Create a compliance-controlled HTS token — securities, real estate, invoices, carbon
          credits, or any real-world asset — with KYC, freeze, wipe, pause, and World ID /
          liveness controls built in.
        </p>
        <Link
          href="/create"
          className="mt-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-4 py-2 hover:opacity-90 transition"
        >
          + Create your first token
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tokens</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tokens.map((token) => (
          <Link
            key={token.id}
            href={`/tokens/${token.id}`}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{token.name}</div>
                <div className="text-sm text-zinc-500">{token.symbol} · {token.id}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wide rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1">
                {token.tokenType}
              </span>
            </div>
            <div className="text-xs text-zinc-500">
              {token.assetCategory ? CATEGORY_LABEL[token.assetCategory] ?? token.assetCategory : "—"}
            </div>
            <div className="flex flex-wrap gap-1 mt-auto">
              {token.compliance.kycRequired && <Badge>KYC</Badge>}
              {token.compliance.freezeDefault && <Badge>Freeze-gated</Badge>}
              {token.compliance.wipeEnabled && <Badge>Wipe</Badge>}
              {token.compliance.pauseEnabled && <Badge>Pausable</Badge>}
              {token.compliance.worldIdRequired && <Badge tone="violet">World ID</Badge>}
              {token.compliance.livenessEnabled && <Badge tone="amber">Liveness</Badge>}
              {token.paused && <Badge tone="red">PAUSED</Badge>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
