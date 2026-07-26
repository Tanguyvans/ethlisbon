"""Sepolia EVM tokenization MCP for Hermes.

This is a thin, keyless stdio adapter. The Next.js platform owns the Sepolia
operator key, contract ABI, SQLite state and World ID policy; MCP tools only
call its agent-safe HTTP API.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

BASE_URL = os.environ.get("TOKENIZATION_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
AGENT_SECRET = os.environ.get("TOKENIZATION_AGENT_SECRET", "")
WORLD_ID_NATIONALITIES = {
    "ARG", "AUS", "CHL", "COL", "CRI", "GBR", "HRV", "ITA",
    "JPN", "KOR", "MEX", "MYS", "PAN", "PRT", "SGP", "USA",
}

mcp = FastMCP("evm")


class TokenizationApiError(RuntimeError):
    pass


def _call(method: str, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"X-Tokenization-Agent-Secret": AGENT_SECRET} if AGENT_SECRET else {}
    try:
        response = httpx.request(
            method, f"{BASE_URL}{path}", json=json, headers=headers, timeout=120.0
        )
    except httpx.HTTPError as exc:
        raise TokenizationApiError(f"Could not reach the tokenization API: {exc}") from exc
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.is_error:
        message = body.get("error") if isinstance(body, dict) else None
        raise TokenizationApiError(message or f"{method} {path} failed ({response.status_code})")
    return body


@mcp.prompt()
def token_deployment_interview() -> str:
    """Return the mandatory questions for a Sepolia ERC-20 deployment."""
    return """Before deploying an irreversible ERC-20 contract on Sepolia, ask and confirm:
1. Name, ticker, decimals, initial supply and finite maximum or infinite supply.
2. RWA category and optional memo.
3. Should every holder complete World ID Selfie Check?
4. If yes, is it one-time or recurring? For recurring checks ask the exact
   interval, convert it to seconds (minimum 60; 300 is five minutes), and
   explain that expiry returns the holder balance to treasury.
5. Optional exact minimum age and supported nationality.
6. Independent freeze, recovery and pause controls.
Summarize every setting and obtain final confirmation before deploy_token.
Sepolia V1 supports fungible ERC-20 tokens; HTS custom fees and NFTs are not available."""


@mcp.tool()
def list_tokens() -> dict[str, Any]:
    """List ERC-20 tokens deployed by this platform on Sepolia."""
    return _call("GET", "/api/evm/tokens")


@mcp.tool()
def get_token(contract_address: str) -> dict[str, Any]:
    """Read a Sepolia token, holders, requests and event log by contract address."""
    return _call("GET", f"/api/tokens/{contract_address}")


@mcp.tool()
def deploy_token(
    name: str,
    symbol: str,
    decimals: int,
    initial_supply: int,
    supply_type: str,
    asset_category: str,
    max_supply: int | None = None,
    memo: str | None = None,
    freeze_default: bool = False,
    recovery_enabled: bool = False,
    pause_enabled: bool = False,
    selfie_check: bool = False,
    minimum_age: int | None = None,
    nationality: str | None = None,
    liveness_enabled: bool = False,
    liveness_period_seconds: int | None = None,
) -> dict[str, Any]:
    """Deploy one compliance-aware fungible ERC-20 contract on Sepolia.

    Amounts are base units. Set liveness_period_seconds=300 for a five-minute
    recurring Selfie Check demo. Any World ID requirement automatically enables
    the contract allowlist; raw World proofs are never sent to this MCP.
    """
    normalized_supply = supply_type.strip().upper()
    if normalized_supply not in {"FINITE", "INFINITE"}:
        raise TokenizationApiError("supply_type must be FINITE or INFINITE.")
    if normalized_supply == "FINITE" and max_supply is None:
        raise TokenizationApiError("max_supply is required for finite supply.")
    normalized_nationality = nationality.strip().upper() if nationality else None
    if normalized_nationality and normalized_nationality not in WORLD_ID_NATIONALITIES:
        raise TokenizationApiError(f"Unsupported World ID nationality: {normalized_nationality}")
    if minimum_age is not None and not 1 <= minimum_age <= 120:
        raise TokenizationApiError("minimum_age must be between 1 and 120.")
    if liveness_enabled and (not selfie_check or not liveness_period_seconds):
        raise TokenizationApiError("Recurring liveness requires Selfie Check and a period.")
    if liveness_enabled and liveness_period_seconds < 60:
        raise TokenizationApiError("liveness_period_seconds must be at least 60.")

    world_required = bool(selfie_check or minimum_age is not None or normalized_nationality)
    body: dict[str, Any] = {
        "blockchain": "EVM",
        "name": name,
        "symbol": symbol,
        "tokenType": "FUNGIBLE",
        "decimals": decimals,
        "initialSupply": initial_supply,
        "supplyType": normalized_supply,
        "assetCategory": asset_category,
        "compliance": {
            "kycRequired": world_required,
            "freezeDefault": freeze_default,
            "wipeEnabled": recovery_enabled,
            "pauseEnabled": pause_enabled,
            "worldIdRequired": world_required,
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
    return _call("POST", "/api/evm/tokens", json=body)


@mcp.tool()
def whitelist_holder(contract_address: str, wallet_address: str) -> dict[str, Any]:
    """Allow a registered Sepolia wallet after all configured World checks pass."""
    return _call("POST", f"/api/tokens/{contract_address}/holders/{wallet_address}/whitelist")


@mcp.tool()
def revoke_holder(contract_address: str, wallet_address: str) -> dict[str, Any]:
    """Remove a Sepolia wallet from the contract allowlist and apply its freeze policy."""
    return _call("POST", f"/api/tokens/{contract_address}/holders/{wallet_address}/revoke")


@mcp.tool()
def distribute(contract_address: str, wallet_address: str, amount_base_units: int) -> dict[str, Any]:
    """Transfer a trusted base-unit amount from the operator treasury to a whitelisted wallet."""
    return _call("POST", f"/api/tokens/{contract_address}/transfer", json={
        "accountId": wallet_address, "amount": amount_base_units
    })


@mcp.tool()
def reclaim_now(contract_address: str, wallet_address: str) -> dict[str, Any]:
    """Return the holder's live balance through recovery or their signed allowance."""
    return _call("POST", f"/api/tokens/{contract_address}/holders/{wallet_address}/reclaim-now")


@mcp.tool()
def pause_token(contract_address: str, paused: bool = True) -> dict[str, Any]:
    """Pause or unpause all ERC-20 movement when the token enabled this control."""
    return _call("POST", f"/api/tokens/{contract_address}/pause", json={"paused": paused})


@mcp.tool()
def get_token_request(request_id: int) -> dict[str, Any]:
    """Read the durable one-token holder request before deciding it."""
    return _call("GET", f"/api/token-requests/{request_id}")


@mcp.tool()
def list_token_requests(status: str = "PENDING") -> dict[str, Any]:
    """List durable requests. Results can include both chains; keep only rows whose
    token record is an EVM/Sepolia contract when acting through this MCP."""
    normalized = status.strip().upper()
    if normalized and normalized not in {"PENDING", "PROCESSING", "FULFILLED", "REJECTED"}:
        raise TokenizationApiError("Invalid request status.")
    suffix = f"?status={normalized}" if normalized else ""
    return _call("GET", f"/api/token-requests{suffix}")


@mcp.tool()
def fulfill_token_request(request_id: int) -> dict[str, Any]:
    """Idempotently mint a shortfall if needed and send exactly the stored one-token amount."""
    return _call("POST", f"/api/token-requests/{request_id}/fulfill")


@mcp.tool()
def reject_token_request(request_id: int, reason: str) -> dict[str, Any]:
    """Reject a pending request only after a definitive compliance failure."""
    return _call("POST", f"/api/token-requests/{request_id}/reject", json={"reason": reason})


@mcp.tool()
def process_liveness_expirations() -> dict[str, Any]:
    """Run the shared liveness worker; expired Sepolia balances use ERC-20 transferFrom."""
    return _call("POST", "/api/liveness/process")


if __name__ == "__main__":
    mcp.run(transport="stdio")
