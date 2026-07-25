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
| [`hermes-agent-template/`](hermes-agent-template/README.md) | Python admin server (Starlette/Uvicorn) that runs the Hermes gateway + dashboard and reverse-proxies the storefront. This is the deployed Docker image. |
| [`tokenization_platform/`](tokenization_platform/README.md) | Next.js 16 app that issues and manages HTS tokens via `@hiero-ledger/sdk` — the public storefront. Built into the same image. |
| [`worldid/`](worldid/README.md) | Standalone "World ID Credential Lab" prototype for testing Selfie/Identity Check with IDKit. A separate experiment, excluded from the deployed image (`worldid` is in `.dockerignore`). |
| `0g_agent_test/` | Empty placeholder, not currently used. |
| `railway.toml`, `.dockerignore` | Root Railway build config — points at `hermes-agent-template/Dockerfile`; build context spans this whole repo. |

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
builds `hermes-agent-template/Dockerfile` with this whole repo as build
context (it needs both `hermes-agent-template/` and `tokenization_platform/`).
See [`hermes-agent-template/README.md`](hermes-agent-template/README.md) for
the full deploy checklist and environment variables.

**Run the full container locally:**

```bash
docker build -f hermes-agent-template/Dockerfile -t hermes-agent .
docker run --rm -it -p 8080:8080 \
  -e PORT=8080 -e ADMIN_PASSWORD=changeme \
  -e HEDERA_NETWORK=testnet -e HEDERA_OPERATOR_ID=0.0.xxxxx \
  -e HEDERA_OPERATOR_KEY=your-private-key \
  -e WALLETCONNECT_PROJECT_ID=your-project-id \
  -v hermes-data:/data hermes-agent
```

Open `http://localhost:8080` for the public storefront; the Hermes dashboard
is at `http://localhost:8080/hermes` (`admin` / your password).

**Run a sub-project standalone** (e.g. for frontend-only iteration):

```bash
cd tokenization_platform   # or worldid/
cp .env.example .env       # or .env.local for worldid/
npm install && npm run dev
```

## Sub-projects

Each folder owns its own detailed README — env vars, architecture, and
known limitations live there, not here:

- **[`hermes-agent-template/README.md`](hermes-agent-template/README.md)** — admin dashboard features, environment variables, supported LLM providers/channels/tools, updating Hermes.
- **[`tokenization_platform/README.md`](tokenization_platform/README.md)** — why HTS over an ERC-20 contract, compliance-checkbox → HTS-feature mapping, the liveness/auto-reclaim scheduled-transaction mechanism, and hackathon-scope simplifications.
- **[`worldid/README.md`](worldid/README.md)** (French) — the standalone World ID Selfie/Identity Check test lab.

## Credits

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- Built for [ETHGlobal Lisbon 2026](https://ethglobal.com/) — Hedera track
