"use client";

import { useWallet } from "@/hooks/useWalletConnect";

function shorten(accountId: string): string {
  return accountId;
}

export default function WalletConnectButton() {
  const { accountId, connecting, error, connect, disconnect } = useWallet();

  if (accountId) {
    return (
      <button
        onClick={disconnect}
        title="Disconnect wallet"
        className="app-wallet-button is-connected"
      >
        <span className="app-wallet-dot" aria-hidden="true" />
        {shorten(accountId)}
      </button>
    );
  }

  return (
    <div className="app-wallet-control">
      <button
        onClick={connect}
        disabled={connecting}
        className="app-wallet-button"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <span className="app-wallet-error">{error}</span>}
    </div>
  );
}
