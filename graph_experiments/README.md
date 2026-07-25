# graph_experiments

Experiment: use The Graph to answer data questions about an ERC20 token on Ethereum Sepolia.

Target token: `0xf531b8f309be94191af87605cfbf600d71c2cfe0` (Sepolia, indexed from block `11350000`).

Two parts:

- `subgraph/` — indexes every `Transfer` event for that token into `Token`, `Account`, and
  `Transfer` entities. `Account.balance` is derived from transfers (mints/burns to/from the zero
  address are tracked but excluded from balance math for the non-zero side, and flagged via
  `Transfer.isMintOrBurn` so you can filter them out of things like "biggest transfer").
- `mcp-server/` — an MCP server exposing tools that query the deployed subgraph's GraphQL
  endpoint: `get_token_info`, `get_biggest_transfer`, `get_top_holders`, `get_recent_transfers`,
  `get_account_balance`.

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

Wait for the Studio dashboard to show the subgraph fully synced, then copy its **Query URL**
from the "Details" tab (looks like
`https://api.studio.thegraph.com/query/<id>/sepolia-test/<version>`).
Queries against Studio's own endpoint are free — no GRT/billing needed for this experiment.

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

## Notes

- If you point this at a different ERC20, update `source.address` and `source.startBlock` in
  `subgraph/subgraph.yaml` (and the address in this README) and redeploy.
- "Biggest transfer" defaults to excluding mints/burns (`excludeMintBurn: true`) since those are
  usually not representative of real holder-to-holder activity — pass `false` to include them.
