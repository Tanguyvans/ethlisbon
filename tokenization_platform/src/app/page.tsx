import { listTokens } from "@/lib/db/repo";
import DeployedTokenCatalog from "@/components/DeployedTokenCatalog";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DeployedTokenCatalog tokens={listTokens()} />;
}
