#!/usr/bin/env node
// Deploys to Graph Studio using GRAPH_DEPLOY_KEY from .env instead of the
// interactive `graph auth` flow, so the whole add-token -> deploy pipeline
// can be driven non-interactively (e.g. from the MCP server).
import { execFileSync } from "node:child_process";

const deployKey = process.env.GRAPH_DEPLOY_KEY;
const subgraphName = process.env.GRAPH_SUBGRAPH_NAME || "sepolia-test";

if (!deployKey) {
  console.error(
    "GRAPH_DEPLOY_KEY is not set. Add it to subgraph/.env (get it from the subgraph's page in Graph Studio)."
  );
  process.exit(1);
}

const versionLabel = process.env.GRAPH_VERSION_LABEL || `auto-${Date.now()}`;

execFileSync(
  "npx",
  [
    "graph",
    "deploy",
    "--node",
    "https://api.studio.thegraph.com/deploy/",
    "--deploy-key",
    deployKey,
    "--version-label",
    versionLabel,
    subgraphName,
  ],
  { stdio: "inherit" }
);
