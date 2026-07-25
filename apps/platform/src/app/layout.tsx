import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWalletConnect";
import WalletConnectButton from "@/components/WalletConnectButton";

export const metadata: Metadata = {
  title: "RWA Access Desk · Hedera",
  description:
    "Explore tokenized real-world assets and prove private eligibility conditions with World ID.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f5f6f2] text-zinc-950">
        <WalletProvider>
          <header className="border-b border-zinc-200/80 bg-[#f9faf7]/90 backdrop-blur sticky top-0 z-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <Link href="/" className="flex items-baseline gap-2 shrink-0">
                <span className="text-lg font-semibold tracking-[-0.035em]">RWA Access Desk</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 hidden sm:inline">
                  Hedera testnet
                </span>
              </Link>
              <div className="grid grid-cols-2 items-start gap-2 sm:flex sm:items-center sm:gap-3">
                {/* This link intentionally exits the tokenization app for the parent Hermes admin dashboard. */}
                <a
                  href="/hermes?force=1"
                  className="text-sm font-medium rounded-lg border border-violet-300/70 px-2 sm:px-3 py-2 text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />
                  Hermes
                </a>
                <WalletConnectButton />
              </div>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-12">{children}</main>
          <footer className="border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-500">
            Built on Hedera Token Service · Eligibility demo — no payment or investment transaction
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
