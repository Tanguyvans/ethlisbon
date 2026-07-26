"""Hedera tokenization MCP server for the Hermes agent.

Thin stdio MCP server exposing the operator-facing Hedera Token Service (HTS)
operations that the `apps/platform` Next.js app already implements. Every
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

HEDERA_NETWORKS = {"mainnet", "testnet", "previewnet"}
# Resolved once and cached (see _mirror_base_url) — the network never changes for a
# running container, so there's no reason to re-fetch it per tool call.
_MIRROR_BASE_URL: str | None = None

WORLD_ID_NATIONALITIES = {
    "ARG", "AUS", "CHL", "COL", "CRI", "GBR", "HRV", "ITA",
    "JPN", "KOR", "MEX", "MYS", "PAN", "PRT", "SGP", "USA",
}

mcp = FastMCP("hedera")


class TokenizationApiError(RuntimeError):
    """Raised with the tokenization app's own {error} message so the agent sees
    the same friendly text a human would get from the REST API (see
    apps/platform/src/lib/api/helpers.ts:handleRoute)."""


@mcp.prompt()
def token_deployment_interview() -> str:
    """Return the mandatory operator questions to ask before deploy_token."""
    return """Before deploying an irreversible HTS token, ask and confirm:
1. Token name.
2. Fungible token or NFT, ticker, decimals, supply type and initial/max supply.
3. RWA category.
4. Should every holder complete World ID Selfie Check?
5. If yes, is Selfie Check one-time or recurring? If recurring, ask the exact
   interval and unit, convert it to seconds (minimum 60; 300 is five minutes),
   and explain that an expired holder's balance returns to treasury.
6. Is there a minimum-age requirement? Ask the exact age or record none.
7. Is there a nationality restriction? Ask the exact supported country or
   record none.
8. Ask any independent freeze, wipe, pause, fee, or memo choices.
Summarize every value and obtain final confirmation before deploy_token.
Recurring liveness requires a fungible token and Selfie Check."""


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


def _mirror_base_url() -> str:
    """Return the Hedera Mirror Node base URL for the active network, cached.

    The Mirror Node host is derived from the network exactly like the platform does
    (apps/platform/src/lib/hedera/mirrorNode.ts): https://{network}.mirrornode.hedera.com.
    Hermes does not inject HEDERA_NETWORK into this MCP's subprocess env today (see
    write_config_yaml in apps/agent/server.py — only the tokenization URL/secret are
    passed), so we resolve it ourselves: honor HEDERA_NETWORK if it's ever set, else
    ask the tokenization app's unauthenticated /api/runtime-config (which reports the
    same network the storefront runs on), else fall back to testnet.
    """
    global _MIRROR_BASE_URL
    if _MIRROR_BASE_URL is not None:
        return _MIRROR_BASE_URL

    network = os.environ.get("HEDERA_NETWORK", "").strip().lower()
    if network not in HEDERA_NETWORKS:
        network = ""
        try:
            resp = httpx.get(f"{BASE_URL}/api/runtime-config", timeout=10.0)
            if resp.is_success:
                candidate = str((resp.json() or {}).get("network", "")).strip().lower()
                if candidate in HEDERA_NETWORKS:
                    network = candidate
        except (httpx.HTTPError, ValueError):
            network = ""
    if not network:
        network = "testnet"

    _MIRROR_BASE_URL = f"https://{network}.mirrornode.hedera.com"
    return _MIRROR_BASE_URL


def _mirror_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """GET a Hedera Mirror Node REST endpoint (read-only, no auth) and return JSON.

    Unlike _call(), this targets the public Mirror Node — a different host and no
    agent-secret header — but raises the same TokenizationApiError on failure so the
    agent sees one consistent error style.
    """
    url = f"{_mirror_base_url()}{path}"
    try:
        resp = httpx.get(url, params=params, timeout=30.0)
    except httpx.HTTPError as exc:
        raise TokenizationApiError(
            f"Could not reach the Hedera Mirror Node at {url}: {exc}."
        ) from exc

    try:
        body = resp.json()
    except ValueError:
        body = {}

    if resp.is_error:
        detail = None
        if isinstance(body, dict):
            messages = (body.get("_status") or {}).get("messages") if isinstance(body.get("_status"), dict) else None
            if isinstance(messages, list) and messages:
                detail = messages[0].get("message") if isinstance(messages[0], dict) else None
        raise TokenizationApiError(
            detail or f"Hedera Mirror Node GET {path} failed with HTTP {resp.status_code}."
        )

    return body if isinstance(body, dict) else {}


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
def process_liveness_expirations() -> dict[str, Any]:
    """Run the deterministic recurring-liveness expiry sweep immediately.
    This is useful for a minute-scale demo; production deployments also run
    the same sweep automatically in the background. The backend chooses every
    expired holder, live balance, and treasury destination from trusted state,
    so this tool accepts no financial parameters.
    """
    return _call("POST", "/api/liveness/process")


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
    selfie_check: bool = False,
    minimum_age: int | None = None,
    nationality: str | None = None,
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
            receiving tokens. Automatically enabled when any World ID check
            is selected, so the operator does not need to choose an HTS gate.
        freeze_default: Set a freeze key with freeze-by-default; holders start
            frozen until explicitly unfrozen (via whitelist_holder).
        wipe_enabled: Set a wipe key, enabling reclaim_now to claw back tokens
            directly.
        pause_enabled: Set a pause key, enabling pause_token.
        selfie_check: Require World ID Selfie Check before whitelisting.
        minimum_age: Optional World ID Identity Check minimum age, from 1 to
            120. Use None when no age restriction is wanted.
        nationality: Optional World ID Identity Check nationality as an ISO
            3166-1 alpha-3 code. Supported values: ARG, AUS, CHL, COL, CRI,
            GBR, HRV, ITA, JPN, KOR, MEX, MYS, PAN, PRT, SGP, USA. Use None
            when no nationality restriction is wanted.
        liveness_enabled: Require holders to repeat World ID Selfie Check and
            automatically return their balance to treasury if they go stale.
            Requires selfie_check and liveness_period_seconds.
        liveness_period_seconds: Re-check period in seconds, minimum 60.
            Minute-scale values are supported for demos (for example 300 is
            five minutes). Policies up to 60 days also receive an on-chain
            Hedera scheduled-transfer safety net; longer policies use the
            deterministic background expiry worker.
    """
    if supply_type == "FINITE" and not max_supply:
        raise TokenizationApiError("max_supply is required when supply_type is FINITE.")
    normalized_nationality = nationality.strip().upper() if nationality else None
    if minimum_age is not None and not 1 <= minimum_age <= 120:
        raise TokenizationApiError("minimum_age must be between 1 and 120.")
    if normalized_nationality and normalized_nationality not in WORLD_ID_NATIONALITIES:
        raise TokenizationApiError(
            f"Unsupported World ID nationality code: {normalized_nationality}."
        )
    world_id_required = bool(selfie_check or minimum_age is not None or normalized_nationality)
    # World ID decisions need a native HTS gate. KYC is the deterministic default: the
    # server grants it only after verification. Freeze remains a separate optional control.
    if world_id_required:
        kyc_required = True
    if liveness_enabled and not selfie_check:
        raise TokenizationApiError(
            "Recurring liveness requires selfie_check=true."
        )
    if liveness_enabled and token_type.upper() != "FUNGIBLE":
        raise TokenizationApiError(
            "Recurring liveness currently supports FUNGIBLE tokens only."
        )
    if liveness_enabled and liveness_period_seconds is None:
        raise TokenizationApiError(
            "liveness_period_seconds is required when liveness_enabled is true."
        )
    if liveness_enabled and liveness_period_seconds < 60:
        raise TokenizationApiError(
            "liveness_period_seconds must be at least 60 (one minute)."
        )

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
            "worldIdSelfieCheck": selfie_check,
            **({"worldIdMinimumAge": minimum_age} if minimum_age is not None else {}),
            **({"worldIdNationality": normalized_nationality} if normalized_nationality else {}),
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


@mcp.tool()
def get_onchain_token_info(token_id: str) -> dict[str, Any]:
    """Read a token's LIVE on-chain state from the Hedera Mirror Node — the ground
    truth from consensus, as opposed to this storefront's own bookkeeping record
    (use get_token for the latter). Prefer this when someone asks about the real
    current supply, treasury, or on-chain configuration of a token we launched.

    Returns the Mirror Node token entity: total_supply and max_supply (in base
    units, NOT decimal-adjusted), decimals, type (FUNGIBLE_COMMON / NON_FUNGIBLE_
    UNIQUE), supply_type, treasury_account_id, pause_status, deleted, custom_fees,
    and which keys are set (admin/kyc/freeze/wipe/supply/pause) — a set key is a
    non-null object, a null key means that capability was not enabled at creation.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
    """
    return _mirror_get(f"/api/v1/tokens/{token_id}")


@mcp.tool()
def get_top_holders(token_id: str, limit: int = 10) -> dict[str, Any]:
    """List the accounts holding the largest current balances of a token, newest
    consensus snapshot first-ranked by balance — i.e. the token's supply
    distribution across the network, from the Hedera Mirror Node. The treasury
    account is normally the #1 holder (it holds all undistributed supply).

    Balances are in the token's base units (NOT decimal-adjusted); the response
    includes each entry's decimals so you can convert to display units.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        limit: Number of holders to return, 1-100 (default 10).
    """
    limit = max(1, min(limit, 100))
    return _mirror_get(
        f"/api/v1/tokens/{token_id}/balances",
        params={"order": "desc", "limit": limit},
    )


@mcp.tool()
def get_holder_balance(account_id: str, token_id: str) -> dict[str, Any]:
    """Get one account's LIVE on-chain balance and HTS compliance flags for a
    single token, from the Hedera Mirror Node. Complements the storefront's own
    holder record (get_token lists registered holders) with consensus truth.

    Returns the account's token relationship — balance (base units, NOT
    decimal-adjusted), freeze_status, and kyc_status — or a clear "not associated"
    result when the account has never associated this token (so its effective
    balance is zero).

    Args:
        account_id: Holder's Hedera account id, e.g. "0.0.654321".
        token_id: Hedera token id, e.g. "0.0.123456".
    """
    body = _mirror_get(
        f"/api/v1/accounts/{account_id}/tokens",
        params={"token.id": token_id, "limit": 1},
    )
    tokens = body.get("tokens") if isinstance(body, dict) else None
    if isinstance(tokens, list) and tokens:
        return {"accountId": account_id, "tokenId": token_id, "relationship": tokens[0]}
    return {
        "accountId": account_id,
        "tokenId": token_id,
        "relationship": None,
        "note": "Account has not associated this token on the network; effective balance is 0.",
    }


@mcp.tool()
def get_recent_token_transfers(token_id: str, limit: int = 20) -> dict[str, Any]:
    """List the most recent on-chain transfers of a token we launched, newest
    first, from the Hedera Mirror Node. Use this to answer "what recently happened
    with this token" — distributions, reclaims, and mints all flow through the
    treasury, and this surfaces exactly those movements.

    The Mirror Node transactions endpoint can't filter by token, so this queries
    the token's treasury account's CRYPTOTRANSFER transactions and keeps only the
    transfer legs for this token. That covers every treasury-involved movement
    (the vast majority for a storefront token); peer-to-peer transfers between two
    non-treasury holders would not appear. Amounts are base units (positive =
    credit to the account, negative = debit); a treasury debit with a holder
    credit is a distribution, the reverse is a reclaim.

    Args:
        token_id: Hedera token id, e.g. "0.0.123456".
        limit: Max number of matching transactions to return, 1-100 (default 20).
    """
    limit = max(1, min(limit, 100))
    info = _mirror_get(f"/api/v1/tokens/{token_id}")
    treasury = info.get("treasury_account_id")
    if not treasury:
        raise TokenizationApiError(
            f"Could not determine the treasury account for token {token_id} from the Mirror Node."
        )

    # Over-fetch before filtering: not every treasury CRYPTOTRANSFER touches this
    # exact token (the treasury/operator is party to many tokens' transfers).
    body = _mirror_get(
        "/api/v1/transactions",
        params={
            "account.id": treasury,
            "transactiontype": "CRYPTOTRANSFER",
            "order": "desc",
            "limit": min(limit * 5, 100),
        },
    )
    transactions = body.get("transactions") if isinstance(body, dict) else None
    matches: list[dict[str, Any]] = []
    for tx in transactions or []:
        legs = [
            {"account": t.get("account"), "amount": t.get("amount")}
            for t in (tx.get("token_transfers") or [])
            if t.get("token_id") == token_id
        ]
        if legs:
            matches.append(
                {
                    "consensus_timestamp": tx.get("consensus_timestamp"),
                    "transaction_id": tx.get("transaction_id"),
                    "result": tx.get("result"),
                    "transfers": legs,
                }
            )
        if len(matches) >= limit:
            break

    return {"tokenId": token_id, "treasuryAccountId": treasury, "transfers": matches}


def _selftest() -> None:
    """Bypass MCP transport and call a tool function directly — useful to
    smoke-test the HTTP wiring against a locally running tokenization app
    without needing an MCP client. Run: python mcps/hedera/server.py --selftest
    """
    import json

    print(f"Calling list_tokens() against {BASE_URL} ...")
    result = list_tokens()
    print(json.dumps(result, indent=2))

    # Exercise the Mirror Node wiring too: resolve the network, then read live
    # on-chain info for the first deployed token if there is one.
    print(f"\nResolved Mirror Node base URL: {_mirror_base_url()}")
    tokens = result.get("tokens") if isinstance(result, dict) else None
    if tokens:
        token_id = tokens[0].get("id")
        print(f"\nCalling get_onchain_token_info({token_id!r}) ...")
        print(json.dumps(get_onchain_token_info(token_id), indent=2))
        print(f"\nCalling get_top_holders({token_id!r}) ...")
        print(json.dumps(get_top_holders(token_id), indent=2))
        print(f"\nCalling get_recent_token_transfers({token_id!r}) ...")
        print(json.dumps(get_recent_token_transfers(token_id), indent=2))
    else:
        print("\nNo deployed tokens found — skipping Mirror Node tool smoke test.")


if __name__ == "__main__":
    import sys

    if "--selftest" in sys.argv:
        _selftest()
    else:
        mcp.run()
