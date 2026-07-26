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
      <body className="app-shell">
        <WalletProvider>
          <header className="app-header">
            <div className="app-header-inner">
              <Link href="/" className="app-brand" aria-label="RWA Access Desk home">
                <span className="app-brand-mark" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="app-brand-copy">
                  <span className="app-brand-name">
                    <span className="app-brand-name-long">RWA Access Desk</span>
                    <span className="app-brand-name-short">RWA Desk</span>
                  </span>
                  <span className="app-brand-network">
                    <span className="app-network-dot" aria-hidden="true" />
                    Hedera testnet
                  </span>
                </span>
              </Link>
              <nav className="app-actions" aria-label="Account actions">
                {/* This link intentionally exits the tokenization app for the parent Hermes admin dashboard. */}
                <a
                  href="/hermes?force=1"
                  className="app-admin-button"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M10 2.7 16 5v4.3c0 3.8-2.5 6.6-6 8-3.5-1.4-6-4.2-6-8V5l6-2.3Z"
                      stroke="currentColor"
                      strokeWidth="1.45"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7.8 9.8 9.3 11l3-3.2"
                      stroke="currentColor"
                      strokeWidth="1.45"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Admin
                </a>
                <WalletConnectButton />
              </nav>
            </div>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <span>RWA Access Desk</span>
            <span>Hedera Token Service · Test environment</span>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
