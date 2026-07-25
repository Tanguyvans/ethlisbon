import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Credential Lab",
  description:
    "Prototype local pour tester World ID Selfie Check et Identity Check.",
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
