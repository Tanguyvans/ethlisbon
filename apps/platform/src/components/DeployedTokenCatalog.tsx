import Link from "next/link";
import type { TokenRecord } from "@/types";

const ACCENTS = [
  {
    chip: "is-sage",
    mark: "is-sage",
  },
  {
    chip: "is-bronze",
    mark: "is-bronze",
  },
  {
    chip: "is-slate",
    mark: "is-slate",
  },
  {
    chip: "is-ink",
    mark: "is-ink",
  },
  {
    chip: "is-violet",
    mark: "is-violet",
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
  if (token.compliance.worldIdSelfieCheck) controls.push("Selfie Check");
  if (token.compliance.worldIdMinimumAge) {
    controls.push(`Age ${token.compliance.worldIdMinimumAge}+`);
  }
  if (token.compliance.worldIdNationality) {
    controls.push(`Nationality ${token.compliance.worldIdNationality}`);
  }
  if (
    token.compliance.worldIdRequired &&
    !token.compliance.worldIdSelfieCheck &&
    !token.compliance.worldIdMinimumAge &&
    !token.compliance.worldIdNationality
  ) {
    controls.push("World ID");
  }
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
        <div className="rwa-hero-copy">
          <p className="rwa-eyebrow">
            <span aria-hidden="true" />
            Tokenized asset registry
          </p>
          <h1>
            Real assets,
            <br />
            <span>clear oversight.</span>
          </h1>
          <p className="rwa-lede">
            Review every instrument deployed by this agent, verify access
            conditions and manage holders from one secure workspace.
          </p>
        </div>
        <div className="rwa-proof-key" aria-label="Registry status">
          <div className="rwa-proof-heading">
            <p>Registry status</p>
            <span>Operational</span>
          </div>
          <div>
            <span className="proof-live-dot" aria-hidden="true" />
            <p>Network</p>
            <strong>Hedera + Sepolia</strong>
          </div>
          <div>
            <span className="proof-sim-dot" aria-hidden="true" />
            <p>Deployed tokens</p>
            <strong>{tokens.length}</strong>
          </div>
        </div>
      </section>

      <div className="rwa-catalog-head" id="instruments">
        <div>
          <p className="rwa-kicker">Asset registry</p>
          <h2>Deployed instruments</h2>
        </div>
        <span className="rwa-no-payment">
          <span className="proof-live-dot" aria-hidden="true" />
          Deployment synced
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
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`rwa-symbol ${accent.mark}`}>{token.symbol}</div>
                    <span className="rwa-token-id">
                      {token.id}
                    </span>
                  </div>

                  <div className="mt-7">
                    <span className={`rwa-asset-chip ${accent.chip}`}>{assetType}</span>
                    <h3>{token.name}</h3>
                    <p className="rwa-description">
                      {token.memo || `A real-world asset token deployed on ${token.blockchain === "EVM" ? "Ethereum Sepolia" : "Hedera Token Service"}.`}
                    </p>
                  </div>

                  <dl className="rwa-meta">
                    <div>
                      <dt>Network</dt>
                      <dd>{token.blockchain === "EVM" ? "Sepolia" : "Hedera"}</dd>
                    </div>
                    <div>
                      <dt>Initial supply</dt>
                      <dd>{token.initialSupply}</dd>
                    </div>
                  </dl>

                  <div className="rwa-requirements">
                    <div className="flex items-center justify-between gap-3">
                      <span>Compliance controls</span>
                      <span className={controls.length ? "rwa-control-count" : "rwa-control-open"}>
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

                  <span className="rwa-card-action">
                    <span>View instrument</span>
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
