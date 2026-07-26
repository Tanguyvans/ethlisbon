# ethlisbon — Agent-Operated Hedera RWA Marketplace

Built for the **ETHGlobal Lisbon 2026** Hedera track ("Tokenization on Hedera" +
"No Solidity Allowed"). A single Railway container runs [Hermes Agent](https://github.com/NousResearch/hermes-agent)
(by Nous Research) as a private operator console alongside a public Next.js
storefront that issues and manages real-world-asset tokens on **Hedera Token
Service (HTS)** — no smart contracts, only native Hedera consensus-enforced
compliance (KYC, freeze, wipe, pause). Access can additionally be gated by
**World ID** (Selfie Check / Identity Check) before the operator grants those
HTS permissions.

The operator talks to the Hermes agent to deploy tokens and run treasury
actions (pause, wipe, whitelist, distribute); the general public only ever
touches the storefront UI directly — browse, connect a Hedera wallet
(HashPack, Kabila, …), and acquire tokens that already exist. There is no
public "create token" button by design.

## Repository layout

| Path | What it is |
|---|---|
| [`apps/platform/`](apps/platform/README.md) | Public Next.js 16 storefront and API. Owns wallets, Hedera operations, persistence, and trusted World ID verification. |
| [`apps/agent/`](apps/agent/README.md) | Private Python operator console. Runs Hermes, the MCP adapters, and the public reverse proxy. Its Dockerfile builds the deployed image. |
| [`docs/`](docs/architecture.md) | Cross-application architecture and ownership boundaries. |
| `railway.toml`, `.dockerignore` | Root deployment configuration; Railway builds `apps/agent/Dockerfile` using the whole repository as context. |

## How it fits together

One Railway container builds the tokenization app and Hermes together, then
runs the Python admin server as the front door:

```
Railway Container
├── Python Admin Server (Starlette + Uvicorn)   ← listens on $PORT
│   ├── /, /tokens/*, /api/tokens/*, /_next/*  — public proxy to the storefront (no auth)
│   ├── /health                                — healthcheck (no auth)
│   ├── /setup/api/*                           — config/status/logs/gateway/pairing (cookie auth)
│   ├── /hermes                                — Hermes dashboard entry point (cookie auth)
│   └── /*                                      — authenticated proxy to the Hermes dashboard
├── Next.js Tokenization Platform  — loopback subprocess, port 3000, owns the root domain
├── World ID MCP                    — proof verification adapter used by Hermes
├── Hermes dashboard                — loopback subprocess, port 9119
└── Hermes gateway                  — managed async subprocess (the agent itself)
```

The storefront (public, no login) owns the root URL. The Hermes admin
dashboard — the agent's own UI plus the operator setup flow — lives under
`/hermes`, protected by cookie auth. Persistent state (Hermes config,
tokenization SQLite DB) lives on a Railway volume mounted at `/data`.

## Tech stack

- **Admin server:** Python 3.12, Starlette, Uvicorn, `httpx`, `websockets`
- **Storefront:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Hedera:** `@hiero-ledger/sdk`, `@hashgraph/hedera-wallet-connect` (WalletConnect), `better-sqlite3`
- **Identity:** `@worldcoin/idkit` (World ID Selfie Check / Identity Check)
- **Agent:** [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research
- **Packaging/deploy:** multi-stage Docker build, Railway

## Running it

**Deploy to Railway:** keep the service Root Directory at `/` — `railway.toml`
builds `apps/agent/Dockerfile` with this whole repo as build context (it needs
both production applications). See [`apps/agent/README.md`](apps/agent/README.md) for
the full deploy checklist and environment variables.

**Run the full container locally:**

```bash
docker build -f apps/agent/Dockerfile -t hermes-agent .
docker run --rm -it -p 8080:8080 \
  -e PORT=8080 -e ADMIN_PASSWORD=changeme \
  -e HEDERA_NETWORK=testnet -e HEDERA_OPERATOR_ID=0.0.xxxxx \
  -e HEDERA_OPERATOR_KEY=your-private-key \
  -e WALLETCONNECT_PROJECT_ID=your-project-id \
  -v hermes-data:/data hermes-agent
```

Open `http://localhost:8080` for the public storefront; the Hermes dashboard
is at `http://localhost:8080/hermes` (`admin` / your password).

**Run the platform standalone** (e.g. for frontend-only iteration):

```bash
cd apps/platform
cp .env.example .env
npm install && npm run dev
```

## Sub-projects

Each folder owns its own detailed README — env vars, architecture, and
known limitations live there, not here:

- **[`apps/agent/README.md`](apps/agent/README.md)** — admin dashboard features, environment variables, supported LLM providers/channels/tools, updating Hermes.
- **[`apps/platform/README.md`](apps/platform/README.md)** — HTS architecture, compliance controls, wallet flow, World ID verification, and known limitations.
- **[`docs/architecture.md`](docs/architecture.md)** — which runtime owns each responsibility and how the single Railway image is assembled.
- **[`docs/hedera.md`](docs/hedera.md)** — Hedera usage, implementation files, and tracks addressed.
- **[`docs/world.md`](docs/world.md)** — World usage and implementation files.
- **[`docs/the_graph.md`](docs/the_graph.md)** — The Graph usage, implementation files, and tracks addressed.
- **[`feedbacks/`](feedbacks/)** — per-sponsor integration feedback (World, The Graph), kept separate from the usage docs above.

## Credits

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- Built for [ETHGlobal Lisbon 2026](https://ethglobal.com/) — Hedera track
