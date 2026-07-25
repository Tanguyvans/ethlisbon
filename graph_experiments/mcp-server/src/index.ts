#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const SUBGRAPH_URL = process.env.SUBGRAPH_URL;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const SUBGRAPH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../subgraph"
);

async function queryGraph(query: string, variables?: Record<string, unknown>) {
  if (!SUBGRAPH_URL) {
    throw new Error(
      "SUBGRAPH_URL is not set. Deploy the subgraph in ../subgraph to Graph Studio, then set " +
        "SUBGRAPH_URL to its query endpoint (Studio 'Details' tab -> Query URL)."
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

server.tool(
  "add_token_source",
  "Add a new ERC20 contract to this subgraph and redeploy to Graph Studio, so it monitors " +
    "another token alongside whatever it already tracks. Requires GRAPH_DEPLOY_KEY in " +
    "subgraph/.env. Runs codegen, build, and deploy -- can take up to a minute.",
  {
    address: z.string().describe("ERC20 contract address to start tracking (0x...)"),
    startBlock: z.number().int().min(0).describe("Block number to start indexing from (deployment/mint block)"),
    name: z
      .string()
      .optional()
      .describe("Optional dataSource name (defaults to ERC20Token<n>)"),
  },
  async ({ address, startBlock, name }) => {
    const steps: string[] = [];
    const run = async (label: string, cmd: string, args: string[]) => {
      steps.push(`$ ${label}`);
      try {
        const { stdout, stderr } = await execFileAsync(cmd, args, {
          cwd: SUBGRAPH_DIR,
          maxBuffer: 1024 * 1024 * 20,
        });
        steps.push(stdout.trim(), stderr.trim());
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message: string };
        steps.push(e.stdout?.trim() ?? "", e.stderr?.trim() ?? "", `FAILED: ${e.message}`);
        throw new Error(steps.filter(Boolean).join("\n"));
      }
    };

    const addArgs = ["run", "add-source", "--", "--address", address, "--start-block", String(startBlock)];
    if (name) addArgs.push("--name", name);

    await run("npm run add-source", "npm", addArgs);
    await run("npm run codegen", "npm", ["run", "codegen"]);
    await run("npm run build", "npm", ["run", "build"]);
    await run("npm run deploy", "npm", ["run", "deploy"]);

    return { content: [{ type: "text" as const, text: steps.filter(Boolean).join("\n") }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
