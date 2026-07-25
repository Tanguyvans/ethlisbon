#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SUBGRAPH_URL = process.env.SUBGRAPH_URL;

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

const server = new McpServer({ name: "graph-experiments", version: "0.1.0" });

server.tool(
  "get_token_info",
  "Get the indexed ERC20 token's name, symbol, decimals, and total transfer count.",
  {},
  async () => {
    const data = await queryGraph(`{
      tokens(first: 1) {
        id
        name
        symbol
        decimals
        transferCount
      }
    }`);
    const tokens = data.tokens as unknown[];
    return textResult(tokens[0] ?? null);
  }
);

server.tool(
  "get_biggest_transfer",
  "Find the largest ERC20 transfer ever indexed for this token, by raw token value.",
  {
    excludeMintBurn: z
      .boolean()
      .default(true)
      .describe("Exclude mints/burns (transfers to/from the zero address)"),
  },
  async ({ excludeMintBurn }) => {
    const where = excludeMintBurn ? ", where: { isMintOrBurn: false }" : "";
    const data = await queryGraph(`{
      transfers(first: 1, orderBy: value, orderDirection: desc${where}) {
        id
        from { id }
        to { id }
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
  { limit: z.number().int().min(1).max(100).default(10) },
  async ({ limit }) => {
    const data = await queryGraph(`{
      accounts(first: ${limit}, orderBy: balance, orderDirection: desc) {
        id
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
  { limit: z.number().int().min(1).max(100).default(20) },
  async ({ limit }) => {
    const data = await queryGraph(`{
      transfers(first: ${limit}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        from { id }
        to { id }
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
  "Get a specific account's current indexed token balance.",
  { address: z.string().describe("Account address (0x...)") },
  async ({ address }) => {
    const data = await queryGraph(
      `query($id: ID!) {
        account(id: $id) {
          id
          balance
          sentCount
          receivedCount
        }
      }`,
      { id: address.toLowerCase() }
    );
    return textResult(data.account ?? null);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
