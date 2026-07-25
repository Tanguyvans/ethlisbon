import Link from "next/link";
import type { TokenRecord } from "@/types";

const ACCENTS = [
  {
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800",
    glow: "from-cyan-300/40 via-sky-100/20 to-transparent",
    mark: "bg-cyan-600",
  },
  {
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    glow: "from-amber-300/40 via-orange-100/20 to-transparent",
    mark: "bg-amber-500",
  },
  {
    chip: "border-rose-200 bg-rose-50 text-rose-800",
    glow: "from-rose-300/35 via-orange-100/20 to-transparent",
    mark: "bg-rose-500",
  },
  {
    chip: "border-slate-300 bg-slate-100 text-slate-800",
    glow: "from-slate-400/35 via-slate-100/20 to-transparent",
    mark: "bg-slate-800",
  },
  {
    chip: "border-violet-200 bg-violet-50 text-violet-800",
    glow: "from-violet-300/40 via-fuchsia-100/20 to-transparent",
    mark: "bg-violet-600",
  },
] as const;

const ASSET_CATEGORY_LABELS: Record<NonNullable<TokenRecord["assetCategory"]>, string> = {
  securities: "Securities",
  "real-estate": "Real estate",
  invoices: "Invoices",
  "carbon-credits": "Carbon credits",
  commodities: "Commodities",
  other: "Tokenized asset",
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 10h12m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function tokenControls(token: TokenRecord) {
  const controls: string[] = [];
  if (token.compliance.worldIdRequired) controls.push("World ID");
  if (token.compliance.kycRequired) controls.push("KYC");
  if (token.compliance.livenessEnabled) controls.push("Liveness");
  if (token.compliance.freezeDefault) controls.push("Freeze");
  if (token.compliance.pauseEnabled) controls.push("Pausable");
  return controls;
}

export default function DeployedTokenCatalog({ tokens }: { tokens: TokenRecord[] }) {
  return (
    <>
      <section className="rwa-hero">
        <div className="max-w-3xl">
          <p className="rwa-eyebrow">Hedera RWA access desk</p>
          <h1>
            Explore real assets.
            <br />
            <span>Manage them on-chain.</span>
          </h1>
          <p className="rwa-lede">
            Browse the tokens deployed by this agent. Open a token to connect a
            wallet, prove eligibility, and manage its holders.
          </p>
        </div>
        <div className="rwa-proof-key" aria-label="Deployment status">
          <div>
            <span className="proof-live-dot" aria-hidden="true" />
            <p>Network</p>
            <strong>Hedera testnet</strong>
          </div>
          <div>
            <span className="proof-sim-dot" aria-hidden="true" />
            <p>Deployed tokens</p>
            <strong>{tokens.length}</strong>
          </div>
        </div>
      </section>

      <div className="rwa-catalog-head">
        <div>
          <p className="rwa-kicker">Live catalog</p>
          <h2>Available instruments</h2>
        </div>
        <span className="rwa-no-payment">
          <span className="proof-live-dot h-1.5 w-1.5" aria-hidden="true" />
          Synced with the deployment
        </span>
      </div>

      {tokens.length === 0 ? (
        <div className="rounded-[1.35rem] border border-zinc-300 bg-white/80 px-6 py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">No token deployed yet</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Once the agent deploys a token, its card will appear here.
          </p>
        </div>
      ) : (
        <div className="rwa-grid">
          {tokens.map((token, index) => {
            const accent = ACCENTS[index % ACCENTS.length];
            const controls = tokenControls(token);
            const assetType = token.assetCategory
              ? ASSET_CATEGORY_LABELS[token.assetCategory]
              : "Tokenized asset";

            return (
              <Link
                key={token.id}
                href={`/tokens/${token.id}`}
                className="rwa-card group block"
                aria-label={`Open ${token.name} (${token.id})`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br ${accent.glow}`}
                  aria-hidden="true"
                />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`rwa-symbol ${accent.mark}`}>{token.symbol}</div>
                    <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-400">
                      {token.id}
                    </span>
                  </div>

                  <div className="mt-7">
                    <span className={`rwa-asset-chip ${accent.chip}`}>{assetType}</span>
                    <h3>{token.name}</h3>
                    <p className="rwa-description">
                      {token.memo || "A real-world asset token deployed on Hedera Token Service."}
                    </p>
                  </div>

                  <dl className="rwa-meta">
                    <div>
                      <dt>Token type</dt>
                      <dd>{token.tokenType === "NFT" ? "NFT" : "Fungible"}</dd>
                    </div>
                    <div>
                      <dt>Initial supply</dt>
                      <dd>{token.initialSupply}</dd>
                    </div>
                  </dl>

                  <div className="rwa-requirements">
                    <div className="flex items-center justify-between gap-3">
                      <span>Compliance controls</span>
                      <span className={controls.length ? "text-violet-700" : "text-emerald-700"}>
                        {controls.length || "Open"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {controls.length ? (
                        controls.map((control) => (
                          <span className="rwa-condition" key={control}>
                            {control}
                          </span>
                        ))
                      ) : (
                        <span className="rwa-condition is-open">No access controls</span>
                      )}
                    </div>
                  </div>

                  <span className="rwa-card-action group-hover:bg-violet-700">
                    <span>Open token</span>
                    <ArrowIcon />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
