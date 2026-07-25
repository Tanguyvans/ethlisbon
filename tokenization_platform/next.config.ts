import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hermes owns the public root and reverse-proxies this application under
  // /tokenization. Keep this value in sync with src/lib/paths.ts.
  basePath: "/tokenization",

  // Produce the minimal Node server embedded in the Hermes container.
  output: "standalone",
};

export default nextConfig;
