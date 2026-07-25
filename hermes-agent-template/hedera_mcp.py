"""Hedera tokenization MCP server for the Hermes agent.

Thin stdio MCP server exposing the operator-facing Hedera Token Service (HTS)
operations that the tokenization_platform Next.js app already implements. Every
tool here is a single HTTP call to that app's REST API on container loopback
(TOKENIZATION_BASE_URL, default http://127.0.0.1:3000) — it performs no Hedera
SDK calls itself and never sees the operator private key. The Next.js app
(`src/lib/hedera/tokenService.ts`) stays the single source of truth: it owns
the operator key, the SQLite bookkeeping DB, and the on-chain event log.

Registered in `config.yaml`'s `mcp_servers.hedera` block (see
server.py:write_config_yaml). Hermes launches this as a subprocess, performs
the MCP handshake, and these tools then appear in the agent's native tool list
alongside its built-in tools.

Gotchas baked into the tool docstrings below because they've bitten people
before:
  - Amounts are in HTS *base units*, not decimal-adjusted display units.
  - `deploy_token` for an NFT collection always starts at supply 0 — per-serial
    minting isn't implemented in the platform yet.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

BASE_URL = os.environ.get("TOKENIZATION_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
AGENT_SECRET = os.environ.get("TOKENIZATION_AGENT_SECRET", "")

mcp = FastMCP("hedera")


class TokenizationApiError(RuntimeError):
    """Raised with the tokenization app's own {error} message so the agent sees
    the same friendly text a human would get from the REST API (see
    tokenization_platform/src/lib/api/helpers.ts:handleRoute)."""


def _call(method: str, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{BASE_URL}{path}"
    headers = {"X-Tokenization-Agent-Secret": AGENT_SECRET} if AGENT_SECRET else {}
    try:
        resp = httpx.request(method, url, json=json, headers=headers, timeout=30.0)
    except httpx.HTTPError as exc:
        raise TokenizationApiError(
            f"Could not reach the tokenization API at {url}: {exc}. "
            "Is the tokenization app running?"
        ) from exc

    try:
        body = resp.json()
    except ValueError:
        body = {}

    if resp.is_error:
        message = body.get("error") if isinstance(body, dict) else None
        raise TokenizationApiError(message or f"{method} {path} failed with HTTP {resp.status_code}")

    return body


@mcp.tool()
def list_tokens() -> dict[str, Any]:
    """List every token deployed so far on this storefront (id, name, symbol,
    type, supply, treasury, compliance settings). Use this to check live data
    before answering questions about what tokens exist — never guess."""
    return _call("GET", "/api/tokens")


@mcp.tool()
def get_token(token_id: str) -> dict[str, Any]:
    """Get full detail for one token: its record, every registered holder
    (association/KYC/whitelist/frozen status), and its on-chain event log.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
    """
    return _call("GET", f"/api/tokens/{token_id}")


@mcp.tool()
def list_token_requests(status: str = "PENDING") -> dict[str, Any]:
    """List durable holder token requests, normally the pending queue. Use
    this for recovery or operator review; webhook-triggered work should use
    get_token_request with the exact id from the prompt.

    Args:
        status: PENDING, PROCESSING, FULFILLED, or REJECTED. Pass an empty
            string only when the operator explicitly asks for every request.
    """
    normalized = status.strip().upper()
    if normalized and normalized not in {"PENDING", "PROCESSING", "FULFILLED", "REJECTED"}:
        raise TokenizationApiError("Invalid request status.")
    suffix = f"?status={normalized}" if normalized else ""
    return _call("GET", f"/api/token-requests{suffix}")


@mcp.tool()
def get_token_request(request_id: int) -> dict[str, Any]:
    """Read one durable request before acting. The stored token, account and
    exact one-display-token amount are authoritative and cannot be changed by
    the fulfillment tool.

    Args:
        request_id: Integer request id supplied by the webhook or queue.
    """
    return _call("GET", f"/api/token-requests/{request_id}")


@mcp.tool()
def fulfill_token_request(request_id: int) -> dict[str, Any]:
    """Atomically fulfill a stored pending request from treasury. The server
    re-validates token type, pause state, wallet association and configured
    compliance/liveness gates. If the treasury balance is too low and the
    token has a supply key, it mints only the exact shortfall before sending
    exactly one display token. Calling this twice cannot create a second mint
    or transfer.

    Args:
        request_id: Integer request id. No destination or amount is accepted.
    """
    return _call("POST", f"/api/token-requests/{request_id}/fulfill")


@mcp.tool()
def reject_token_request(request_id: int, reason: str) -> dict[str, Any]:
    """Reject a pending request after a definitive compliance failure. Do not
    reject transient API, network, provider, or Hedera errors; leave those
    pending for retry.

    Args:
        request_id: Integer request id.
        reason: Concise holder-facing reason, maximum 500 characters.
    """
    return _call("POST", f"/api/token-requests/{request_id}/reject", json={"reason": reason})


@mcp.tool()
def deploy_token(
    name: str,
    symbol: str,
    token_type: str = "FUNGIBLE",
    decimals: int = 0,
    initial_supply: int = 0,
    supply_type: str = "INFINITE",
    max_supply: int | None = None,
    asset_category: str = "other",
    memo: str | None = None,
    kyc_required: bool = False,
    freeze_default: bool = False,
    wipe_enabled: bool = False,
    pause_enabled: bool = False,
    world_id_required: bool = False,
    liveness_enabled: bool = False,
    liveness_period_seconds: int | None = None,
) -> dict[str, Any]:
    """Deploy (create) a new HTS token. The operator account becomes the
    treasury and holds every admin-style key this call turns on. There is no
    public "create token" UI by design — this is the only way a new token gets
    listed on the storefront, so always confirm the token name with the
    operator before calling this.

    Args:
        name: Display name, 1-100 chars.
        symbol: Ticker symbol, 1-20 chars.
        token_type: "FUNGIBLE" or "NFT". NFT collections are created at supply
            0 — per-serial minting is not yet implemented on this platform, so
            don't promise minted NFTs after this call.
        decimals: Ignored (forced to 0) for NFT.
        initial_supply: In base units. Ignored (forced to 0) for NFT.
        supply_type: "FINITE" or "INFINITE". "FINITE" requires max_supply.
        max_supply: Required when supply_type is "FINITE", in base units.
        asset_category: One of "securities", "real-estate", "invoices",
            "carbon-credits", "commodities", "other".
        memo: Optional on-chain memo, max 100 chars.
        kyc_required: Set a KYC key; holders must be KYC-granted before
            receiving tokens.
        freeze_default: Set a freeze key with freeze-by-default; holders start
            frozen until explicitly unfrozen (via whitelist_holder).
        wipe_enabled: Set a wipe key, enabling reclaim_now to claw back tokens
            directly.
        pause_enabled: Set a pause key, enabling pause_token.
        world_id_required: Require World ID verification before a holder can
            be whitelisted. Needs kyc_required or freeze_default enabled too
            (World ID needs one of those as the actual gating mechanism).
        liveness_enabled: Enable recurring liveness re-checks with scheduled
            auto-reclaim if a holder goes stale. Requires
            liveness_period_seconds.
        liveness_period_seconds: Liveness re-check period in seconds. Required
            when liveness_enabled is true.
    """
    if supply_type == "FINITE" and not max_supply:
        raise TokenizationApiError("max_supply is required when supply_type is FINITE.")
    if world_id_required and not (kyc_required or freeze_default):
        raise TokenizationApiError(
            "world_id_required needs a whitelisting mechanism to gate — enable "
            "kyc_required and/or freeze_default too."
        )
    if liveness_enabled and not liveness_period_seconds:
        raise TokenizationApiError("liveness_period_seconds is required when liveness_enabled is true.")

    body: dict[str, Any] = {
        "name": name,
        "symbol": symbol,
        "tokenType": token_type,
        "decimals": decimals,
        "initialSupply": initial_supply,
        "supplyType": supply_type,
        "assetCategory": asset_category,
        "compliance": {
            "kycRequired": kyc_required,
            "freezeDefault": freeze_default,
            "wipeEnabled": wipe_enabled,
            "pauseEnabled": pause_enabled,
            "worldIdRequired": world_id_required,
            "livenessEnabled": liveness_enabled,
            **({"livenessPeriodSeconds": liveness_period_seconds} if liveness_period_seconds else {}),
        },
    }
    if max_supply is not None:
        body["maxSupply"] = max_supply
    if memo:
        body["memo"] = memo

    return _call("POST", "/api/tokens", json=body)


@mcp.tool()
def whitelist_holder(token_id: str, account_id: str) -> dict[str, Any]:
    """Approve a registered holder: grants KYC and/or unfreezes their account
    (whichever the token's compliance settings require) and marks them
    WHITELISTED, so they can receive a distribution. The holder must have
    already registered and associated the token on their end.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        account_id: Holder's Hedera account id, e.g. "0.0.654321".
    """
    return _call("POST", f"/api/tokens/{token_id}/holders/{account_id}/whitelist")


@mcp.tool()
def revoke_holder(token_id: str, account_id: str) -> dict[str, Any]:
    """Revoke a holder's compliance status: revokes KYC and/or re-freezes their
    account and cancels any scheduled auto-reclaim, marking them REVOKED. Does
    not move their existing token balance — use reclaim_now for that.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        account_id: Holder's Hedera account id, e.g. "0.0.654321".
    """
    return _call("POST", f"/api/tokens/{token_id}/holders/{account_id}/revoke")


@mcp.tool()
def distribute(token_id: str, account_id: str, amount: float) -> dict[str, Any]:
    """Transfer tokens from the treasury to a whitelisted holder. The holder
    must already be marked WHITELISTED (via whitelist_holder) — Hedera will
    still reject the transfer on-chain if they aren't actually compliant even
    if our bookkeeping says otherwise.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        account_id: Recipient's Hedera account id, e.g. "0.0.654321".
        amount: Amount in the token's base units (NOT decimal-adjusted display
            units) — for a token with decimals=2, "100" is 1.00 of the token.
    """
    return _call("POST", f"/api/tokens/{token_id}/transfer", json={"accountId": account_id, "amount": amount})


@mcp.tool()
def reclaim_now(token_id: str, account_id: str) -> dict[str, Any]:
    """Immediately claw back a holder's entire current balance back to the
    treasury (compliance reclaim) — uses the wipe key if the token has one,
    otherwise a pre-granted allowance. Cancels any pending scheduled reclaim.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        account_id: Holder's Hedera account id, e.g. "0.0.654321".
    """
    return _call("POST", f"/api/tokens/{token_id}/holders/{account_id}/reclaim-now")


@mcp.tool()
def pause_token(token_id: str, paused: bool = True) -> dict[str, Any]:
    """Pause or unpause a token. While paused, no transfers of this token can
    happen for anyone (requires the token to have been created with
    pause_enabled).

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        paused: True to pause, False to unpause.
    """
    return _call("POST", f"/api/tokens/{token_id}/pause", json={"paused": paused})


def _selftest() -> None:
    """Bypass MCP transport and call a tool function directly — useful to
    smoke-test the HTTP wiring against a locally running tokenization app
    without needing an MCP client. Run: python hedera_mcp.py --selftest
    """
    import json

    print(f"Calling list_tokens() against {BASE_URL} ...")
    result = list_tokens()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    import sys

    if "--selftest" in sys.argv:
        _selftest()
    else:
        mcp.run()
