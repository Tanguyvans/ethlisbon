import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWalletConnect";
import WalletConnectButton from "@/components/WalletConnectButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hedera Tokenization Platform",
  description: "Create and manage compliance-controlled real-world-asset tokens on Hedera Token Service",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <WalletProvider>
          <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-baseline gap-2 shrink-0">
                <span className="text-lg font-semibold tracking-tight">Tokenization Platform</span>
                <span className="text-xs text-zinc-500 hidden sm:inline">on Hedera Token Service</span>
              </Link>
              <div className="flex items-center gap-3">
                <Link
                  href="/create"
                  className="text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 py-2 hover:opacity-90 transition"
                >
                  + Create token
                </Link>
                <WalletConnectButton />
              </div>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">{children}</main>
          <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
            Built on Hedera Token Service · Testnet demo — not audited, not financial advice
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
