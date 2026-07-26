import Image from "next/image";
import Link from "next/link";
import type { TokenRecord } from "@/types";

const ACCENTS = [
  {
    chip: "is-sage",
    mark: "is-sage",
  },
  {
    chip: "is-lemon",
    mark: "is-lemon",
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
      <section className="mint-hero" aria-labelledby="mint-hero-title">
        <div className="mint-hero-copy">
          <p className="rwa-eyebrow">
            <span aria-hidden="true" />
            Agent-operated token marketplace
          </p>
          <h1 id="mint-hero-title">
            Mint assets.
            <br />
            <span>Keep it chill.</span>
          </h1>
          <p className="mint-hero-lede">
            Browse tokens deployed by Hermes across Hedera and Sepolia. Connect
            your wallet, complete the required checks, and let the agent handle
            distribution.
          </p>
          <div className="mint-hero-actions">
            <a href="#instruments" className="mint-primary-link">
              Explore assets
              <ArrowIcon />
            </a>
            <span className="mint-network-note">Hedera · Sepolia · World ID</span>
          </div>
        </div>

        <div className="mint-mascot-stage" aria-label="Hermes agent status">
          <Image
            src="/brand/logo-512.png"
            alt="Mint & Chill lemon mascot"
            width={512}
            height={512}
            className="mint-mascot"
            priority
          />
          <div className="mint-agent-status">
            <span className="proof-live-dot" aria-hidden="true" />
            <span>
              <small>Hermes agent</small>
              <strong>Ready to verify</strong>
            </span>
          </div>
        </div>
      </section>

      <div className="rwa-catalog-head is-page-start" id="instruments">
        <div>
          <p className="rwa-kicker">Live registry</p>
          <h2>Available tokens</h2>
        </div>
        <span className="rwa-no-payment">
          <span className="proof-live-dot" aria-hidden="true" />
          Synced by Hermes
        </span>
      </div>

      {tokens.length === 0 ? (
        <div className="mint-empty-state">
          <Image
            src="/brand/logo-512.png"
            alt=""
            width={72}
            height={72}
            aria-hidden="true"
          />
          <h3 className="text-xl font-semibold">No token deployed yet</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Ask Hermes to deploy one. It will appear here when the transaction is confirmed.
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
