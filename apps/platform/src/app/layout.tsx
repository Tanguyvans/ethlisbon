import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWalletConnect";
import { EvmWalletProvider } from "@/hooks/useEvmWallet";
import WalletConnectButton from "@/components/WalletConnectButton";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.TOKENIZATION_APP_URL ?? "http://localhost:3000"),
  title: "Mint & Chill · Agent-operated token marketplace",
  description:
    "Discover tokenized assets, prove eligibility, and let Hermes handle distribution across Hedera and Sepolia.",
  icons: {
    icon: "/brand/logo-512.png",
    apple: "/brand/logo-512.png",
  },
  openGraph: {
    title: "Mint & Chill",
    description: "Agent-operated token deployment, eligibility, and distribution.",
    images: ["/brand/banner-16x9.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="app-shell">
        <WalletProvider>
          <EvmWalletProvider>
          <header className="app-header">
            <div className="app-header-inner">
              <Link href="/" className="app-brand" aria-label="Mint & Chill home">
                <Image
                  src="/brand/logo-512.png"
                  alt=""
                  width={48}
                  height={48}
                  className="app-brand-mark"
                  priority
                />
                <span className="app-brand-copy">
                  <span className="app-brand-name">
                    <span className="app-brand-name-long">mint &amp; chill</span>
                    <span className="app-brand-name-short">m&amp;c</span>
                  </span>
                  <span className="app-brand-network">
                    <span className="app-network-dot" aria-hidden="true" />
                    Hedera + Sepolia
                  </span>
                </span>
              </Link>
              <nav className="app-actions" aria-label="Account actions">
                {/* This link intentionally exits the tokenization app for the parent Hermes admin dashboard. */}
                <a
                  href="/hermes?force=1"
                  className="app-admin-button"
                  aria-label="Open Hermes admin"
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
            <span>mint &amp; chill</span>
            <span>Agent-operated · Hedera + Sepolia</span>
          </footer>
          </EvmWalletProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
