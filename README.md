<p align="center">
  <img src="brand/banner-16x9.png" alt="ethlisbon banner" width="100%" />
</p>

# Hermes — Agent-Operated RWA Marketplace

Deploy this repo on Railway and get a ready-to-use, agent-operated platform
for creating and distributing tokenized assets. Hermes launches tokens on
Hedera or EVM, defines who may hold them, and manages their lifecycle in
natural language — no manual blockchain tooling.

Users browse a public marketplace, connect a wallet, request a token, and
complete a World ID check. Hermes verifies the result and autonomously
approves or rejects distribution. For EVM assets, The Graph supplies indexed
transfer and holder data so the agent can monitor what it manages.

Built for **ETHGlobal Lisbon 2026** (Hedera, World, The Graph tracks).

## How it works

A public Next.js storefront and a private Hermes admin console run together
as a single Railway service — storefront, API, agent dashboard, and MCP
servers all in one repo, deployable from one place.

The admin describes a token and its eligibility rules to Hermes. A user
connects a wallet, requests the token, and completes World ID verification.
Raw proofs stay in the trusted Next.js backend; Hermes only ever sees a
sanitized verification result, which it evaluates against the token policy
before rejecting the request or executing the distribution.

Hermes is connected to four MCP integrations:

- **Hedera MCP** — deploys and operates tokens via native HTS, no Solidity.
- **EVM MCP** — deploys ERC-20 tokens on Sepolia.
- **World ID MCP** — triggers holder verification in the trusted backend.
- **The Graph MCP** — queries a subgraph indexing EVM transfers, balances, and holders.

## Repository layout

| Path | What it is |
|---|---|
| [`apps/platform/`](apps/platform/README.md) | Public Next.js storefront and API — wallets, Hedera operations, persistence, trusted World ID verification. |
| [`apps/agent/`](apps/agent/README.md) | Private Python operator console — Hermes, MCP adapters, and the reverse proxy. Its Dockerfile builds the deployed image. |
| [`docs/`](docs/architecture.md) | Cross-application architecture and ownership boundaries. |
| `railway.toml`, `.dockerignore` | Root deploy config — Railway builds `apps/agent/Dockerfile` with the whole repo as context. |

## Tech stack

TypeScript, React, Next.js, SQLite, WalletConnect, Python, Starlette — plus
`@hiero-ledger/sdk` for Hedera and `@worldcoin/idkit` for World ID.

## Running it

**Deploy to Railway:** keep the service Root Directory at `/`. See
[`apps/agent/README.md`](apps/agent/README.md) for the full deploy checklist
and environment variables.

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

Storefront: `http://localhost:8080`. Hermes dashboard:
`http://localhost:8080/hermes` (`admin` / your password).

**Run the platform standalone:**

```bash
cd apps/platform
cp .env.example .env
npm install && npm run dev
```

## More

- [`apps/agent/README.md`](apps/agent/README.md) — admin dashboard, env vars, LLM providers/channels/tools, updating Hermes.
- [`apps/platform/README.md`](apps/platform/README.md) — HTS architecture, compliance controls, wallet flow, World ID, known limitations.
- [`docs/architecture.md`](docs/architecture.md) — runtime ownership and image assembly.
- [`docs/hedera.md`](docs/hedera.md) · [`docs/world.md`](docs/world.md) · [`docs/the_graph.md`](docs/the_graph.md) — per-sponsor usage and implementation notes.
- [`feedbacks/`](feedbacks/) — per-sponsor integration feedback.

## Credits

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- Built for [ETHGlobal Lisbon 2026](https://ethglobal.com/)
