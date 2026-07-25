"use client";

import { DAppConnector, HederaChainId, HederaJsonRpcMethod, HederaSessionEvent } from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hiero-ledger/sdk";

// Browser-only singleton. Uses the "legacy" (but still fully supported) DAppConnector API
// rather than the full Reown AppKit stack — we only need "connect a Hedera wallet and sign
// native HTS/Schedule transactions", not the EVM/Wagmi side of AppKit, so this keeps the
// client bundle and setup surface much smaller. See node_modules/@hashgraph/hedera-wallet-connect
// README ("Legacy: Using this library and underlying WalletConnect libraries directly").

let connectorPromise: Promise<DAppConnector> | null = null;

function ledgerIdFor(network: string): LedgerId {
  if (network === "mainnet") return LedgerId.MAINNET;
  if (network === "previewnet") return LedgerId.PREVIEWNET;
  return LedgerId.TESTNET;
}

function chainIdFor(network: string): HederaChainId {
  if (network === "mainnet") return HederaChainId.Mainnet;
  if (network === "previewnet") return HederaChainId.Previewnet;
  return HederaChainId.Testnet;
}

export function getDAppConnector(): Promise<DAppConnector> {
  if (typeof window === "undefined") {
    throw new Error("getDAppConnector() must only be called in the browser");
  }
  if (!connectorPromise) {
    connectorPromise = (async () => {
      const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet";
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        throw new Error(
          "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Get a free project id at https://cloud.reown.com and add it to .env"
        );
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

      const connector = new DAppConnector(
        {
          name: "Hedera Tokenization Platform",
          description: "Create and manage compliance-controlled HTS tokens",
          url: appUrl,
          icons: [`${appUrl}/globe.svg`],
        },
        ledgerIdFor(network),
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [chainIdFor(network)]
      );
      await connector.init({ logger: "error" });
      return connector;
    })();
  }
  return connectorPromise;
}
