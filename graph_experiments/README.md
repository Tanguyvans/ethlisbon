# graph_experiments

Experiment: use The Graph to let an agent index and answer data questions about ERC20 tokens it
deploys, on Ethereum Sepolia (The Graph doesn't index Hedera yet). Ships with one default token
tracked: `0xf531b8f309be94191af87605cfbf600d71c2cfe0` (Sepolia, indexed from block `11350000`) —
see "Adding/removing tracked tokens" below to change the set.

Two parts:

- `subgraph/` — indexes every `Transfer` event for an agent-chosen set of ERC20 contracts into
  `Token`, `Account`, and `Transfer` entities (one dataSource per tracked token, all sharing the
  same handler). `Account.balance` is derived from transfers (mints/burns to/from the zero
  address are tracked but excluded from balance math for the non-zero side, and flagged via
  `Transfer.isMintOrBurn` so you can filter them out of things like "biggest transfer").
- `mcp-server/` — an MCP server exposing tools that query the deployed subgraph's GraphQL
  endpoint (`get_token_info`, `get_biggest_transfer`, `get_top_holders`, `get_recent_transfers`,
  `get_account_balance`), plus tools that mutate and redeploy the subgraph itself
  (`get_tracked_tokens`, `add_token_source`, `set_token_sources`).

## 1. Deploy the subgraph

Requires a free [Graph Studio](https://thegraph.com/studio/) account.

```bash
cd subgraph
npm install
npx graph auth --studio <YOUR_DEPLOY_KEY>   # from Studio: create a subgraph first, grab its deploy key
# (`graph auth --studio` still works fine even though `deploy --studio` doesn't on this CLI version)
npm run codegen
npm run build
npm run deploy   # deploys to the subgraph name "sepolia-test" — rename in package.json if you used a different name in Studio
```

Wait for the Studio dashboard to show the subgraph fully synced, then grab its query URL from the
"Details" tab -- but use the **`version/latest`** form, not the version-pinned one Studio shows by
default (`.../sepolia-test/auto-<timestamp>`, which freezes to that specific deploy):

```
https://api.studio.thegraph.com/query/<id>/sepolia-test/version/latest
```

Studio always resolves `version/latest` to whichever version was deployed most recently, so
`SUBGRAPH_URL` set to this form never goes stale -- every future redeploy (via `add_token_source`
/ `set_token_sources`) is picked up automatically, no config changes needed. `deploy.mjs` prints
both forms after every deploy as a reminder. Queries against Studio's own endpoint are free — no
GRT/billing needed for this experiment.

## 2. Run the MCP server

```bash
cd mcp-server
npm install
SUBGRAPH_URL="<query url from step 1>" npm start
```

To wire it into Claude Code, add an entry to your MCP config pointing at this server, e.g.:

```json
{
  "mcpServers": {
    "graph-experiments": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/graph_experiments/mcp-server/src/index.ts"],
      "env": { "SUBGRAPH_URL": "<query url from step 1>" }
    }
  }
}
```

## Adding/removing tracked tokens

- **`set_token_sources`** (MCP tool) replaces the *entire* tracked set in one call — pass the full
  list of `{address, startBlock, name?}` you want tracked; anything omitted is dropped. This is
  the only way to remove a token. Equivalent CLI: `npm run set-sources -- --tokens '[...]'` in
  `subgraph/`, then `npm run codegen && npm run build && npm run deploy`.
- **`add_token_source`** (MCP tool) appends one token without disturbing the rest — convenience
  wrapper, can't remove anything.
- The first dataSource is always named `ERC20Token` regardless of what you pass — `src/mapping.ts`
  imports codegen output from that fixed name, so it can't be renamed per-token.
- Every deploy gets a fresh Graph Studio version label, but that's invisible to `SUBGRAPH_URL` as
  long as it's set to the `version/latest` form (see step 1 above) — no runtime bookkeeping needed.

## Notes

- "Biggest transfer" defaults to excluding mints/burns (`excludeMintBurn: true`) since those are
  usually not representative of real holder-to-holder activity — pass `false` to include them.
- This is wired into the Hermes Railway deployment (`hermes-agent-template/`) as the `graph` MCP
  server — see that template's `.env.example` for the `GRAPH_DEPLOY_KEY` / `GRAPH_SUBGRAPH_NAME` /
  `SUBGRAPH_URL` Railway variables it needs.
