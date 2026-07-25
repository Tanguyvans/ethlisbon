#!/bin/bash
set -e

# Mirror dashboard-ref-only's startup: create every directory hermes expects
# and seed a default config.yaml if the volume is empty. Without these,
# `hermes dashboard` endpoints that hit logs/, sessions/, cron/, etc. can fail
# with opaque errors even though no auth is actually involved.
# NOTE (hermes >= v2026.7.1): several dirs were consolidated and are now
# resolved via get_hermes_dir("<new>", "<old>"), which returns the NEW path
# unless the OLD one already has *content*. Seeding an empty legacy stub no
# longer "claims" it — hermes ignores empty stubs and writes to the new path
# (upstream #27602). So we seed the NEW paths: pairing -> platforms/pairing,
# image_cache -> cache/images, audio_cache -> cache/audio. A populated legacy
# dir from a pre-v2026.7.1 deploy still wins on both sides, so no migration is
# needed. server.py:_resolve_pairing_dir() mirrors this same rule for the
# admin panel's Users tab — keep the two in sync on future bumps.
mkdir -p /data/.hermes/cron /data/.hermes/sessions /data/.hermes/logs \
         /data/.hermes/memories /data/.hermes/skills /data/.hermes/platforms/pairing \
         /data/.hermes/hooks /data/.hermes/cache/images /data/.hermes/cache/audio \
         /data/.hermes/workspace /data/.hermes/skins /data/.hermes/plans \
         /data/.hermes/home /data/tokenization /data/graph

# Seed a writable copy of the subgraph (manifest + node_modules) onto the
# volume so the graph MCP's set_token_sources/add_token_source tools can
# rewrite subgraph.yaml and redeploy without touching the image, and so the
# agent's tracked-token-set edits survive container redeploys. Only done once
# per volume — never overwrite an already-seeded copy, same idiom as the
# agent-identity seeding below. GRAPH_MCP_DIR's image copy is left untouched
# as the source of truth for the MCP server's own code.
if [ ! -d /data/graph/subgraph ] && [ -d /opt/graph_experiments/subgraph ]; then
  cp -r /opt/graph_experiments/subgraph /data/graph/subgraph

  # One-time bootstrap only: if the operator already has a synced subgraph in
  # Studio and passed its query URL via the SUBGRAPH_URL Railway variable,
  # record it into the SAME persistent file the graph MCP itself reads and
  # keeps up to date after every redeploy (SUBGRAPH_DIR/.query-url). This
  # runs only on a brand-new volume, i.e. exactly once ever for a given
  # deployment -- after that the MCP server owns this file and Railway's
  # SUBGRAPH_URL is never consulted again, so it can go stale (every
  # redeploy changes Studio's query URL) without silently clobbering the
  # MCP's own up-to-date value the way an env-var-sourced config used to.
  if [ -n "${SUBGRAPH_URL}" ]; then
    printf '%s\n' "${SUBGRAPH_URL}" > /data/graph/subgraph/.query-url
  fi
fi

# Stamp the install method as "docker" so hermes treats this as an immutable
# container image, not a pip checkout. hermes's detect_install_method() reads
# $HERMES_HOME/.install_method FIRST (before any .git / pip fallback). Without
# this stamp the template falls through to "pip" — because the Dockerfile strips
# /opt/hermes-agent/.git — and the dashboard's "Update Hermes" button then runs
# a real `hermes update` (PyPI pip-upgrade) INSIDE the running container. That
# upgrade is ephemeral (reverts on the next redeploy) and can desync the Python
# package from the image's pre-built web_dist/ui-tui bundles. Stamping "docker"
# makes that button correctly refuse with "pull a fresh image / redeploy", which
# matches the real upgrade path here (bump HERMES_REF in Railway + redeploy).
# Written unconditionally each boot so it stays correct and self-heals.
printf 'docker\n' > /data/.hermes/.install_method

if [ ! -f /data/.hermes/config.yaml ] && [ -f /opt/hermes-agent/cli-config.yaml.example ]; then
  cp /opt/hermes-agent/cli-config.yaml.example /data/.hermes/config.yaml
fi

[ ! -f /data/.hermes/.env ] && touch /data/.hermes/.env

# Seed the agent's identity/context files from the repo-committed defaults
# baked into the image, but only if the volume doesn't already have one. This
# lets a fresh (or wiped) deployment come up already knowing what it's for,
# while never clobbering an edit made later by the operator or by the agent
# itself (it has file tools and is expected to update these over time).
#
# Routing matters: Hermes loads these two file classes from DIFFERENT places.
#   - Project-context files (AGENTS.md, .hermes.md, CLAUDE.md, .cursorrules)
#     are discovered from the SESSION WORKING DIRECTORY (terminal.cwd, which
#     server.py now points at /data/.hermes/workspace) and injected into the
#     system prompt at session start. Seeding them into HERMES_HOME does
#     nothing — that path is never scanned for them.
#   - SOUL.md and other identity files are loaded from HERMES_HOME directly.
# So we seed project-context files into the workspace dir and everything else
# into HERMES_HOME root. Keep terminal.cwd (server.py AGENT_WORKDIR) in sync
# with the workspace path used here.
if [ -d /opt/hermes-agent-identity ]; then
  for f in /opt/hermes-agent-identity/*; do
    name="$(basename "$f")"
    case "$name" in
      AGENTS.md|.hermes.md|CLAUDE.md|.cursorrules)
        dest="/data/.hermes/workspace/$name" ;;
      *)
        dest="/data/.hermes/$name" ;;
    esac
    [ ! -f "$dest" ] && cp "$f" "$dest"
  done
fi

# Bootstrap OAuth tokens from env var (e.g. xAI Grok SuperGrok).
# Set HERMES_AUTH_JSON_BOOTSTRAP to the contents of a locally-generated
# ~/.hermes/auth.json. Written only once — subsequent token refreshes update
# the file in place on the persistent volume.
if [ ! -f /data/.hermes/auth.json ] && [ -n "${HERMES_AUTH_JSON_BOOTSTRAP}" ]; then
  printf '%s' "${HERMES_AUTH_JSON_BOOTSTRAP}" > /data/.hermes/auth.json
  chmod 600 /data/.hermes/auth.json
fi

# Clear any stale gateway PID file left over from the previous container.
# `hermes gateway` writes /data/.hermes/gateway.pid on start but does not
# remove it on SIGTERM. Since /data is a persistent volume, the file
# survives container restarts and causes every subsequent boot to exit with
# "ERROR gateway.run: PID file race lost to another gateway instance".
# No hermes process can be running at this point (we're pre-exec in a fresh
# container), so removing the file unconditionally is safe.
rm -f /data/.hermes/gateway.pid

exec python /app/server.py
