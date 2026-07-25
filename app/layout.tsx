import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Selfie Check Lab",
  description: "Prototype local pour tester World ID Selfie Check.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
