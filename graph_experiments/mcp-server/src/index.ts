#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
// Overridable so a deployment can point this at a writable, volume-backed
// copy of the subgraph (code ships in the image; the manifest needs to
// persist across redeploys). Defaults to the sibling checkout for local/dev
// use.
const SUBGRAPH_DIR = process.env.SUBGRAPH_DIR
  ? path.resolve(process.env.SUBGRAPH_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../subgraph");
const MANIFEST_PATH = path.join(SUBGRAPH_DIR, "subgraph.yaml");

// MUST be the "/version/latest" query URL (Studio Details tab shows a
// version-pinned one by default, e.g. ".../sepolia-test/auto-1785...") --
// swap the trailing version label for the literal path segment
// "version/latest" and Studio always resolves it to whatever was deployed
// most recently, so this env var stays correct across every redeploy
// without anything needing to track/update it.
const SUBGRAPH_URL = process.env.SUBGRAPH_URL;

async function queryGraph(query: string, variables?: Record<string, unknown>) {
  if (!SUBGRAPH_URL) {
    throw new Error(
      "SUBGRAPH_URL is not set. Deploy the subgraph in ../subgraph to Graph Studio (e.g. via the " +
        "set_token_sources tool), then set SUBGRAPH_URL to its query endpoint using the " +
        "'version/latest' path segment (not the version-pinned URL Studio's 'Details' tab shows), " +
        "e.g. https://api.studio.thegraph.com/query/<id>/<name>/version/latest -- that way it keeps " +
        "resolving to whatever was deployed most recently."
    );
  }
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Subgraph HTTP error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: unknown; errors?: unknown };
  if (json.errors) {
    throw new Error(`Subgraph query error: ${JSON.stringify(json.errors)}`);
  }
  return json.data as Record<string, unknown>;
}

interface DataSource {
  name: string;
  source: { address: string; startBlock: number };
}

function readTrackedTokens(): DataSource[] {
  const manifest = yaml.load(readFileSync(MANIFEST_PATH, "utf8")) as { dataSources: DataSource[] };
  return manifest.dataSources;
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function tokenWhere(tokenAddress: string | undefined, extra?: string): string {
  const clauses = [
    ...(tokenAddress ? [`token: "${tokenAddress.toLowerCase()}"`] : []),
    ...(extra ? [extra] : []),
  ];
  return clauses.length ? `, where: { ${clauses.join(", ")} }` : "";
}

const server = new McpServer({ name: "graph-experiments", version: "0.1.0" });

const tokenAddressArg = z
  .string()
  .optional()
  .describe("Restrict to one tracked token's contract address (0x...). Omit to query across all tracked tokens.");

server.tool(
  "get_token_info",
  "List the indexed ERC20 token(s)' name, symbol, decimals, and total transfer count.",
  { tokenAddress: tokenAddressArg },
  async ({ tokenAddress }) => {
    const where = tokenAddress ? `(where: { id: "${tokenAddress.toLowerCase()}" })` : "";
    const data = await queryGraph(`{
      tokens${where} {
        id
        name
        symbol
        decimals
        transferCount
      }
    }`);
    return textResult(data.tokens);
  }
);

server.tool(
  "get_biggest_transfer",
  "Find the largest ERC20 transfer ever indexed, by raw token value.",
  {
    tokenAddress: tokenAddressArg,
    excludeMintBurn: z
      .boolean()
      .default(true)
      .describe("Exclude mints/burns (transfers to/from the zero address)"),
  },
  async ({ tokenAddress, excludeMintBurn }) => {
    const where = tokenWhere(tokenAddress, excludeMintBurn ? "isMintOrBurn: false" : undefined);
    const data = await queryGraph(`{
      transfers(first: 1, orderBy: value, orderDirection: desc${where}) {
        id
        token { id symbol }
        from { address }
        to { address }
        value
        isMintOrBurn
        blockNumber
        blockTimestamp
        transactionHash
      }
    }`);
    const transfers = data.transfers as unknown[];
    return textResult(transfers[0] ?? null);
  }
);

server.tool(
  "get_top_holders",
  "List the accounts with the largest current token balances.",
  { tokenAddress: tokenAddressArg, limit: z.number().int().min(1).max(100).default(10) },
  async ({ tokenAddress, limit }) => {
    const where = tokenWhere(tokenAddress);
    const data = await queryGraph(`{
      accounts(first: ${limit}, orderBy: balance, orderDirection: desc${where}) {
        token { id symbol }
        address
        balance
        sentCount
        receivedCount
      }
    }`);
    return textResult(data.accounts);
  }
);

server.tool(
  "get_recent_transfers",
  "List the most recent token transfers, newest first.",
  { tokenAddress: tokenAddressArg, limit: z.number().int().min(1).max(100).default(20) },
  async ({ tokenAddress, limit }) => {
    const where = tokenWhere(tokenAddress);
    const data = await queryGraph(`{
      transfers(first: ${limit}, orderBy: blockTimestamp, orderDirection: desc${where}) {
        id
        token { id symbol }
        from { address }
        to { address }
        value
        isMintOrBurn
        blockTimestamp
        transactionHash
      }
    }`);
    return textResult(data.transfers);
  }
);

server.tool(
  "get_account_balance",
  "Get a specific account's current indexed token balance(s).",
  {
    address: z.string().describe("Account address (0x...)"),
    tokenAddress: tokenAddressArg,
  },
  async ({ address, tokenAddress }) => {
    const where = tokenWhere(tokenAddress, `address: "${address.toLowerCase()}"`);
    const data = await queryGraph(`{
      accounts(first: 100${where}) {
        token { id symbol }
        address
        balance
        sentCount
        receivedCount
      }
    }`);
    return textResult(data.accounts);
  }
);

server.tool(
  "get_latest_sepolia_block",
  "Get the latest block number on Ethereum Sepolia by calling a public JSON-RPC endpoint " +
    "(no subgraph indexing involved -- this is live chain state).",
  {},
  async () => {
    const res = await fetch(SEPOLIA_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
    });
    if (!res.ok) {
      throw new Error(`RPC HTTP error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { result?: string; error?: unknown };
    if (json.error) {
      throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    }
    const blockNumber = parseInt(json.result as string, 16);
    return textResult({ blockNumber, hex: json.result, rpcUrl: SEPOLIA_RPC_URL });
  }
);

const tokenAddressPattern = /^0x[0-9a-fA-F]{40}$/;

// Shared by every tool that mutates subgraph.yaml and redeploys: runs a list
// of npm-script steps in the subgraph dir and collects their combined output
// for the tool result (read by an LLM agent, not a human -- see deploy.mjs
// for why we redact the version-pinned URL out of its stdout). We append an
// explicit, unambiguous closing line rather than relying on the agent to
// correctly infer "no config change needed" from the deploy log.
async function runDeployPipeline(steps: Array<{ label: string; cmd: string; args: string[] }>) {
  const log: string[] = [];
  for (const { label, cmd, args } of steps) {
    log.push(`$ ${label}`);
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd: SUBGRAPH_DIR,
        maxBuffer: 1024 * 1024 * 20,
      });
      log.push(stdout.trim(), stderr.trim());
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      log.push(e.stdout?.trim() ?? "", e.stderr?.trim() ?? "", `FAILED: ${e.message}`);
      throw new Error(log.filter(Boolean).join("\n"));
    }
  }
  log.push(
    "Deploy succeeded. No SUBGRAPH_URL / MCP config change is needed -- it should already point at " +
      "the stable '.../version/latest' Studio URL, which now serves this deploy automatically. Do " +
      "not tell the user to update SUBGRAPH_URL."
  );
  return log.filter(Boolean).join("\n");
}

server.tool(
  "get_tracked_tokens",
  "List the ERC20 tokens this subgraph is currently configured to index (from subgraph.yaml), " +
    "before deciding what to pass to set_token_sources.",
  {},
  async () => {
    const tokens = readTrackedTokens().map((ds) => ({
      name: ds.name,
      address: ds.source.address,
      startBlock: ds.source.startBlock,
    }));
    return textResult(tokens);
  }
);

server.tool(
  "add_token_source",
  "Add a new ERC20 contract to this subgraph and redeploy to Graph Studio, so it monitors " +
    "another token alongside whatever it already tracks, without disturbing the rest of the set. " +
    "For removing tokens, or replacing the whole tracked set in one step, use set_token_sources " +
    "instead. Requires GRAPH_DEPLOY_KEY in the environment (or subgraph/.env for local use). Runs " +
    "codegen, build, and deploy -- can take up to a minute; wait for it to finish before retrying.",
  {
    address: z.string().regex(tokenAddressPattern).describe("ERC20 contract address to start tracking (0x...)"),
    startBlock: z.number().int().min(0).describe("Block number to start indexing from (deployment/mint block)"),
    name: z
      .string()
      .optional()
      .describe("Optional dataSource name (defaults to ERC20Token<n>)"),
  },
  async ({ address, startBlock, name }) => {
    const addArgs = ["run", "add-source", "--", "--address", address, "--start-block", String(startBlock)];
    if (name) addArgs.push("--name", name);

    const text = await runDeployPipeline([
      { label: "npm run add-source", cmd: "npm", args: addArgs },
      { label: "npm run codegen", cmd: "npm", args: ["run", "codegen"] },
      { label: "npm run build", cmd: "npm", args: ["run", "build"] },
      { label: "npm run deploy", cmd: "npm", args: ["run", "deploy"] },
    ]);
    return { content: [{ type: "text" as const, text }] };
  }
);

server.tool(
  "set_token_sources",
  "Replace the ENTIRE set of ERC20 tokens this subgraph tracks with exactly the given list, then " +
    "redeploy to Graph Studio -- the way to both add and remove tokens in one call (any tracked " +
    "token not included is dropped). Call get_tracked_tokens first if you need to know the current " +
    "set before editing it. Requires GRAPH_DEPLOY_KEY in the environment (or subgraph/.env for local " +
    "use). Runs codegen, build, and deploy -- can take up to a minute; wait for it to finish before " +
    "retrying, and note freshly-added tokens need time to sync before query tools return their data.",
  {
    tokens: z
      .array(
        z.object({
          address: z.string().regex(tokenAddressPattern).describe("ERC20 contract address (0x...)"),
          startBlock: z.number().int().min(0).describe("Block number to start indexing from"),
          name: z
            .string()
            .optional()
            .describe("Optional dataSource name (ignored for the first token, which is always named ERC20Token)"),
        })
      )
      .min(1)
      .describe("The full desired set of tracked tokens -- anything omitted is removed."),
  },
  async ({ tokens }) => {
    const text = await runDeployPipeline([
      {
        label: "npm run set-sources",
        cmd: "npm",
        args: ["run", "set-sources", "--", "--tokens", JSON.stringify(tokens)],
      },
      { label: "npm run codegen", cmd: "npm", args: ["run", "codegen"] },
      { label: "npm run build", cmd: "npm", args: ["run", "build"] },
      { label: "npm run deploy", cmd: "npm", args: ["run", "deploy"] },
    ]);
    return { content: [{ type: "text" as const, text }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
