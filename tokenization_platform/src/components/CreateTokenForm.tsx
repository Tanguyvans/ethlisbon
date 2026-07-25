"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, ErrorText, Field, Select, TextInput } from "@/components/ui";
import { withTokenizationBasePath } from "@/lib/paths";
import type { AssetCategory, CustomFeeType, SupplyType, TokenType } from "@/types";

const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: "securities", label: "Securities" },
  { value: "real-estate", label: "Real estate" },
  { value: "invoices", label: "Invoices" },
  { value: "carbon-credits", label: "Carbon credits" },
  { value: "commodities", label: "Commodities" },
  { value: "other", label: "Other" },
];

const PERIOD_UNITS = [
  { value: 60, label: "minutes" },
  { value: 3600, label: "hours" },
  { value: 86400, label: "days" },
];

export default function CreateTokenForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tokenType, setTokenType] = useState<TokenType>("FUNGIBLE");
  const [decimals, setDecimals] = useState(2);
  const [initialSupply, setInitialSupply] = useState(1000);
  const [supplyType, setSupplyType] = useState<SupplyType>("FINITE");
  const [maxSupply, setMaxSupply] = useState(1000000);
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("securities");
  const [memo, setMemo] = useState("");

  const [kycRequired, setKycRequired] = useState(true);
  const [freezeDefault, setFreezeDefault] = useState(false);
  const [wipeEnabled, setWipeEnabled] = useState(true);
  const [pauseEnabled, setPauseEnabled] = useState(true);
  const [worldIdRequired, setWorldIdRequired] = useState(false);
  const [livenessEnabled, setLivenessEnabled] = useState(false);
  const [livenessValue, setLivenessValue] = useState(10);
  const [livenessUnit, setLivenessUnit] = useState(60); // minutes by default — easy to demo live

  const [customFeeEnabled, setCustomFeeEnabled] = useState(false);
  const [customFeeType, setCustomFeeType] = useState<CustomFeeType>("FIXED_HBAR");
  const [fixedHbar, setFixedHbar] = useState(0.1);
  const [fracNumerator, setFracNumerator] = useState(1);
  const [fracDenominator, setFracDenominator] = useState(100);
  const [fracMin, setFracMin] = useState(0);
  const [fracMax, setFracMax] = useState(1000);
  const [fracAssessedToSender, setFracAssessedToSender] = useState(false);
  const [royaltyNumerator, setRoyaltyNumerator] = useState(5);
  const [royaltyDenominator, setRoyaltyDenominator] = useState(100);
  const [royaltyFallbackHbar, setRoyaltyFallbackHbar] = useState(1);

  const canWorldId = kycRequired || freezeDefault;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        symbol,
        tokenType,
        decimals: tokenType === "NFT" ? 0 : decimals,
        initialSupply: tokenType === "NFT" ? 0 : initialSupply,
        supplyType,
        maxSupply: supplyType === "FINITE" ? maxSupply : undefined,
        assetCategory,
        memo: memo || undefined,
        compliance: {
          kycRequired,
          freezeDefault,
          wipeEnabled,
          pauseEnabled,
          worldIdRequired: canWorldId && worldIdRequired,
          livenessEnabled,
          livenessPeriodSeconds: livenessEnabled ? livenessValue * livenessUnit : undefined,
        },
        customFee: customFeeEnabled
          ? customFeeType === "FIXED_HBAR"
            ? { type: "FIXED_HBAR", amountHbar: fixedHbar }
            : customFeeType === "FRACTIONAL"
              ? {
                  type: "FRACTIONAL",
                  numerator: fracNumerator,
                  denominator: fracDenominator,
                  minAmount: fracMin,
                  maxAmount: fracMax,
                  assessedToSender: fracAssessedToSender,
                }
              : {
                  type: "ROYALTY",
                  numerator: royaltyNumerator,
                  denominator: royaltyDenominator,
                  fallbackFeeHbar: royaltyFallbackHbar,
                }
          : undefined,
      };

      const res = await fetch(withTokenizationBasePath("/api/tokens"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create token");
      router.push(`/tokens/${data.token.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Basics</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name">
            <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Real Estate Fund I" />
          </Field>
          <Field label="Symbol">
            <TextInput required value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AREF1" maxLength={20} />
          </Field>
          <Field label="Asset category">
            <Select value={assetCategory} onChange={(e) => setAssetCategory(e.target.value as AssetCategory)}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Token type">
            <Select value={tokenType} onChange={(e) => setTokenType(e.target.value as TokenType)}>
              <option value="FUNGIBLE">Fungible (shares, credits, invoices...)</option>
              <option value="NFT">Non-fungible (unique deed / certificate)</option>
            </Select>
          </Field>
          {tokenType === "FUNGIBLE" && (
            <>
              <Field label="Decimals">
                <TextInput type="number" min={0} max={18} value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} />
              </Field>
              <Field label="Initial supply" hint="Minted to the treasury at creation, in base units">
                <TextInput type="number" min={0} value={initialSupply} onChange={(e) => setInitialSupply(Number(e.target.value))} />
              </Field>
            </>
          )}
          <Field label="Supply type">
            <Select value={supplyType} onChange={(e) => setSupplyType(e.target.value as SupplyType)}>
              <option value="FINITE">Finite (capped)</option>
              <option value="INFINITE">Infinite</option>
            </Select>
          </Field>
          {supplyType === "FINITE" && (
            <Field label="Max supply">
              <TextInput type="number" min={1} value={maxSupply} onChange={(e) => setMaxSupply(Number(e.target.value))} />
            </Field>
          )}
        </div>
        <Field label="Memo" hint="Optional, stored on the token itself (max 100 bytes)">
          <TextInput value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={100} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Compliance controls</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Each option sets a real HTS key on the token at creation. World ID / liveness are
            off-chain gates layered on top (see badges on the token page for how each check maps
            to on-chain state).
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Checkbox
            label="Require KYC approval"
            description="Sets a KYC key. Holders can't receive the token until you grant KYC to their account."
            checked={kycRequired}
            onChange={setKycRequired}
          />
          <Checkbox
            label="Freeze new accounts by default"
            description="Sets a freeze key + freeze-by-default. Holders start frozen until you unfreeze them — a second, independent whitelisting mechanism."
            checked={freezeDefault}
            onChange={setFreezeDefault}
          />
          <Checkbox
            label="Enable wipe / clawback"
            description="Sets a wipe key so compliance actions can immediately reclaim (burn) tokens from any account."
            checked={wipeEnabled}
            onChange={setWipeEnabled}
          />
          <Checkbox
            label="Enable pause"
            description="Sets a pause key so you can halt all transfers of this token network-wide in an emergency."
            checked={pauseEnabled}
            onChange={setPauseEnabled}
          />
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col gap-3">
          <Checkbox
            label="Require World ID human verification before whitelisting"
            description={
              canWorldId
                ? "Holders must pass a World ID proof-of-personhood check before you can grant KYC / unfreeze them. (Verification is currently a stubbed mock — see README.)"
                : "Requires KYC and/or freeze-by-default above, since World ID gates the whitelisting step."
            }
            checked={worldIdRequired}
            disabled={!canWorldId}
            onChange={setWorldIdRequired}
          />
          <Checkbox
            label="Enable liveness check-ins & auto-reclaim"
            description="Holders periodically 'check in' with their wallet. If a holder goes silent past the period below, their balance is automatically reclaimed to the treasury via a Hedera long-term Scheduled Transaction — no bot/cron required."
            checked={livenessEnabled}
            onChange={setLivenessEnabled}
          />
          {livenessEnabled && (
            <div className="flex items-center gap-2 pl-7">
              <span className="text-sm">Reclaim if no check-in for</span>
              <TextInput
                type="number"
                min={1}
                value={livenessValue}
                onChange={(e) => setLivenessValue(Number(e.target.value))}
                className="w-20"
              />
              <Select value={livenessUnit} onChange={(e) => setLivenessUnit(Number(e.target.value))} className="w-32">
                {PERIOD_UNITS.map((u) => (
                  <option key={u.label} value={u.value}>{u.label}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <Checkbox
          label="Add a custom fee"
          description="Charge a fee (paid to the treasury) on every transfer of this token."
          checked={customFeeEnabled}
          onChange={setCustomFeeEnabled}
        />
        {customFeeEnabled && (
          <div className="pl-1 flex flex-col gap-3">
            <Field label="Fee type">
              <Select value={customFeeType} onChange={(e) => setCustomFeeType(e.target.value as CustomFeeType)}>
                <option value="FIXED_HBAR">Fixed (HBAR per transfer)</option>
                <option value="FRACTIONAL">Fractional (% of amount transferred)</option>
                <option value="ROYALTY">Royalty (NFT resale %, with fallback)</option>
              </Select>
            </Field>
            {customFeeType === "FIXED_HBAR" && (
              <Field label="Amount (HBAR)">
                <TextInput type="number" step="0.01" min={0} value={fixedHbar} onChange={(e) => setFixedHbar(Number(e.target.value))} />
              </Field>
            )}
            {customFeeType === "FRACTIONAL" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Numerator"><TextInput type="number" min={1} value={fracNumerator} onChange={(e) => setFracNumerator(Number(e.target.value))} /></Field>
                <Field label="Denominator"><TextInput type="number" min={1} value={fracDenominator} onChange={(e) => setFracDenominator(Number(e.target.value))} /></Field>
                <Field label="Min fee (base units)"><TextInput type="number" min={0} value={fracMin} onChange={(e) => setFracMin(Number(e.target.value))} /></Field>
                <Field label="Max fee (base units)"><TextInput type="number" min={1} value={fracMax} onChange={(e) => setFracMax(Number(e.target.value))} /></Field>
                <Checkbox
                  label="Assessed to sender"
                  description="On: sender's transferred amount is reduced by the fee. Off: fee is added on top."
                  checked={fracAssessedToSender}
                  onChange={setFracAssessedToSender}
                />
              </div>
            )}
            {customFeeType === "ROYALTY" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Numerator"><TextInput type="number" min={1} value={royaltyNumerator} onChange={(e) => setRoyaltyNumerator(Number(e.target.value))} /></Field>
                <Field label="Denominator"><TextInput type="number" min={1} value={royaltyDenominator} onChange={(e) => setRoyaltyDenominator(Number(e.target.value))} /></Field>
                <Field label="Fallback fee (HBAR)" hint="Charged when royalty can't be assessed in HTS">
                  <TextInput type="number" step="0.01" min={0} value={royaltyFallbackHbar} onChange={(e) => setRoyaltyFallbackHbar(Number(e.target.value))} />
                </Field>
              </div>
            )}
          </div>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating token on Hedera testnet…" : "Create token"}
      </Button>
    </form>
  );
}
