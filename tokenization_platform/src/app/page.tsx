import RwaMarketplace from "@/components/RwaMarketplace";
import { RWA_TOKENS } from "@/lib/rwaCatalog";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "";
  const isConfigured = Boolean(
    appId && process.env.WORLD_RP_ID && process.env.WORLD_RP_SIGNING_KEY,
  );

  return (
    <RwaMarketplace
      tokens={RWA_TOKENS}
      worldConfig={{
        appId,
        isConfigured,
        selfieEnvironment: "production",
        identityEnvironment: "staging",
        selfieSignal:
          process.env.NEXT_PUBLIC_WORLD_SIGNAL ?? "rwa-marketplace-holder",
      }}
    />
  );
}
