#!/usr/bin/env node
// Deploys to Graph Studio using GRAPH_DEPLOY_KEY from the environment instead
// of the interactive `graph auth` flow, so the whole add/remove-token ->
// deploy pipeline can be driven non-interactively (e.g. from the MCP server).
//
// Every deploy gets a fresh --version-label, which means the version-pinned
// "Queries (HTTP)" URL Studio prints on success is different every time --
// don't configure SUBGRAPH_URL from that. Studio also serves a stable
// "<id>/<name>/version/latest" URL that always resolves to whichever version
// was deployed most recently, so that's the one to configure once and never
// touch again. We print both below: the pinned one purely for debugging this
// specific deploy, and the version/latest one as what SUBGRAPH_URL should be.
import { execFileSync } from "node:child_process";

const deployKey = process.env.GRAPH_DEPLOY_KEY;
const subgraphName = process.env.GRAPH_SUBGRAPH_NAME || "sepolia-test";

if (!deployKey) {
  console.error(
    "GRAPH_DEPLOY_KEY is not set. Set it in the environment (or subgraph/.env for local use) -- " +
      "get it from the subgraph's page in Graph Studio."
  );
  process.exit(1);
}

const versionLabel = process.env.GRAPH_VERSION_LABEL || `auto-${Date.now()}`;

let output;
try {
  output = execFileSync(
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
    { encoding: "utf8" }
  );
} catch (err) {
  // Surface whatever the CLI printed before failing, then re-throw so the
  // caller (npm, or the MCP server's execFile wrapper) sees a non-zero exit.
  process.stdout.write(err.stdout ?? "");
  process.stderr.write(err.stderr ?? "");
  process.exit(err.status ?? 1);
}

process.stdout.write(output);

// Studio prints a "Queries (HTTP): https://api.studio.thegraph.com/query/<id>/<name>/<version>"
// line on success. Grab the last studio query URL mentioned, in case other
// URLs (deploy/playground) also appear in the output.
const matches = [...output.matchAll(/https:\/\/api\.studio\.thegraph\.com\/query\/(\d+)\/([^/\s]+)\/\S+/g)];
const lastMatch = matches.at(-1);

if (lastMatch) {
  const [pinnedUrl, id, name] = lastMatch;
  console.log(`Deployed version URL (debugging only, changes every deploy): ${pinnedUrl}`);
  console.log(
    `SUBGRAPH_URL should be (stable, set this once): https://api.studio.thegraph.com/query/${id}/${name}/version/latest`
  );
} else {
  console.error("Could not find a Queries (HTTP) URL in `graph deploy` output.");
}
