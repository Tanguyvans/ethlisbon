# Hermes Agent — Railway Template

Deploy [Hermes Agent](https://github.com/NousResearch/hermes-agent) on [Railway](https://railway.app) with a web-based admin dashboard for configuration, gateway management, and user pairing.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/hermes-agent-ai?referralCode=QXdhdr&utm_medium=integration&utm_source=template&utm_campaign=generic)

> Hermes Agent is an autonomous AI agent by [Nous Research](https://nousresearch.com/) that lives on your server, connects to your messaging channels (Telegram, Discord, Slack, etc.), and gets more capable the longer it runs.

<!-- TODO: Add dashboard screenshot -->
<!-- ![Dashboard](docs/dashboard.png) -->

## Features

- **Admin Dashboard** — dark-themed UI to configure providers, channels, tools, and manage the gateway
- **One-Page Setup** — provider dropdown, checkbox-based channel/tool toggles — no config files to edit
- **Gateway Management** — start, stop, restart the Hermes gateway from the browser
- **Live Status** — stat cards for gateway state, uptime, model, and pending pairing requests
- **Live Logs** — streaming gateway log viewer
- **User Pairing** — approve or deny users who message your bot, revoke access anytime
- **Hedera Tokenization UI** — open the integrated Next.js tokenization platform and connect a Hedera wallet from Hermes
- **Cookie Auth** — password-protected Hermes dashboard and setup
- **Public Tokenization UI** — wallet users can open `/tokenization` without the Hermes admin login
- **Reset Config** — one-click reset to start fresh
- **Backup & Restore** — download a full snapshot (config, credentials, chat history, memories, skills) as a zip, and restore it — including into a fresh project — to clone a deployment. Not encrypted; a safety snapshot is taken automatically before every restore.

## Getting Started

The easiest way to get started:

### 1. Get an LLM Provider Key (free)

1. Register for free at [OpenRouter](https://openrouter.ai/)
2. Create an API key from your [OpenRouter dashboard](https://openrouter.ai/keys)
3. Pick a free model from the [model list sorted by price](https://openrouter.ai/models?order=pricing-low-to-high) (e.g. `google/gemma-3-1b-it:free`, `meta-llama/llama-3.1-8b-instruct:free`)

### 2. Set Up a Telegram Bot (fastest channel)

Hermes Agent interacts entirely through messaging channels — there is no chat UI like ChatGPT. Telegram is the quickest to set up:

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and copy the **Bot Token**
3. Send a message to your new bot — it will appear as a pairing request in the admin dashboard
4. To find your Telegram user ID, message [@userinfobot](https://t.me/userinfobot)

### 3. Deploy to Railway

1. Click the **Deploy on Railway** button above
2. Set the `ADMIN_PASSWORD` environment variable (or a random one will be generated and printed to deploy logs)
3. Attach a **volume** mounted at `/data` (persists config across redeploys)
4. Open your app URL — log in with username `admin` and your password

### 4. Configure in the Admin Dashboard

1. **LLM Provider** — select OpenRouter from the dropdown, paste your API key, enter the model name
2. **Messaging Channel** — check Telegram, paste the Bot Token from BotFather
3. Click **Save & Start** — the gateway will start and your bot goes live

### 5. Start Chatting

Message your Telegram bot. If you're a new user, a pairing request will appear in the admin dashboard under **Users** — click **Approve**, and you're in.

<!-- TODO: Add Telegram chat screenshot -->
<!-- ![Telegram Example](docs/telegram-example.png) -->

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Web server port (set automatically by Railway) |
| `ADMIN_USERNAME` | `admin` | Basic auth username |
| `ADMIN_PASSWORD` | *(auto-generated)* | Sign-in password — if unset, a random password is printed to logs |
| `HERMES_REF` | *(pinned in Dockerfile)* | Hermes Agent version to install (any upstream git tag/branch). Set this to override the Dockerfile default without editing code — see [Updating Hermes](#updating-hermes). |
| `HEDERA_NETWORK` | `testnet` | Hedera network used by both the operator and connected wallets. |
| `HEDERA_OPERATOR_ID` | *(required for token actions)* | Server-side operator/treasury account ID. |
| `HEDERA_OPERATOR_KEY` | *(required for token actions)* | Server-side operator private key. Never expose it to the browser or agent chat. |
| `WALLETCONNECT_PROJECT_ID` | *(required for wallet connection)* | Reown project ID served to the wallet client at runtime. |
| `TOKENIZATION_APP_URL` | *(derived from browser URL)* | Optional canonical public URL ending in `/tokenization`, used in wallet metadata. |
| `DATABASE_PATH` | `/data/tokenization/tokenization.db` | Persistent SQLite database path in the Railway volume. |

All other configuration (LLM provider, model, channels, tools) is managed through the admin dashboard.

## Supported Providers

OpenRouter, DeepSeek, DashScope, GLM / Z.AI, Kimi, MiniMax, HuggingFace

## Supported Channels

Telegram, Discord, Slack, WhatsApp, Email, Mattermost, Matrix

## Supported Tool Integrations

Parallel (search), Firecrawl (scraping), Tavily (search), FAL (image gen), Browserbase, GitHub, OpenAI Voice (Whisper/TTS), Honcho (memory)

## Architecture

```
Railway Container
├── Python Admin Server (Starlette + Uvicorn)
│   ├── /            — Native Hermes dashboard (cookie auth)
│   ├── /health      — Health check (no auth)
│   ├── /setup/api/* — Config, status, logs, gateway, pairing
│   ├── /tokenization/* — Public proxy to the Next.js platform
│   └── /*            — Authenticated proxy to the native Hermes dashboard
├── Next.js Tokenization Platform — private loopback subprocess on port 3000
├── Hermes dashboard — private loopback subprocess on port 9119
└── Hermes gateway   — managed async subprocess
```

The admin server runs on `$PORT` and manages Hermes plus the tokenization UI as child processes. Hermes config is stored in `/data/.hermes`, while tokenization data is stored in `/data/tokenization/tokenization.db`. The Next.js server is bound to loopback, so its UI and API can only be reached through Hermes authentication.

## Running Locally

```bash
docker build -f hermes-agent-template/Dockerfile -t hermes-agent .
docker run --rm -it -p 8080:8080 \
  -e PORT=8080 \
  -e ADMIN_PASSWORD=changeme \
  -e HEDERA_NETWORK=testnet \
  -e HEDERA_OPERATOR_ID=0.0.xxxxx \
  -e HEDERA_OPERATOR_KEY=your-private-key \
  -e WALLETCONNECT_PROJECT_ID=your-project-id \
  -v hermes-data:/data \
  hermes-agent
```

Open `http://localhost:8080/tokenization` to use the public tokenization platform.
The Hermes dashboard at `http://localhost:8080` remains protected with
`admin` / `changeme`.

For Railway, keep the service **Root Directory** set to `/`. The repository-level
`railway.toml` selects `hermes-agent-template/Dockerfile`, whose build context
needs both `hermes-agent-template/` and `tokenization_platform/`.

## Updating Hermes

This template pins a specific Hermes Agent release in the `Dockerfile` (`ARG HERMES_REF`, currently `v2026.7.1`). To upgrade:

- **Recommended:** set a `HERMES_REF` service variable in Railway to any upstream [release tag](https://github.com/NousResearch/hermes-agent/releases) (e.g. `v2026.7.1`), then redeploy. It's passed in as a Docker build arg and overrides the Dockerfile default — no code change needed.
- **Or** bump `ARG HERMES_REF` in the `Dockerfile` and redeploy.

The "Update" button inside the Hermes dashboard is a **no-op on Railway** (it detects a container install and refuses) — the image is immutable, so a runtime self-update wouldn't survive a redeploy. Bump `HERMES_REF` and redeploy instead. When jumping releases, re-check that the Dockerfile's install extras still match upstream's `pyproject.toml`.

## Credits

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- UI inspired by [OpenClaw](https://github.com/praveen-ks-2001/openclaw-railway) admin template
