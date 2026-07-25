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
        className="text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 sm:px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition flex items-center justify-center gap-2 whitespace-nowrap"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {shorten(accountId)}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <button
        onClick={connect}
        disabled={connecting}
        className="text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 sm:px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition disabled:opacity-50 whitespace-nowrap"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <span className="text-xs text-red-600 max-w-[220px] text-right">{error}</span>}
    </div>
  );
}
