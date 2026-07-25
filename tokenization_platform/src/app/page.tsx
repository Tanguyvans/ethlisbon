import { redirect } from "next/navigation";
import { listTokens } from "@/lib/db/repo";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const [token] = listTokens();
  if (token) redirect(`/tokens/${token.id}`);

  return (
    <Card className="text-center py-16">
      <h1 className="text-xl font-semibold">No token deployed yet</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Once the operator deploys this deployment&apos;s token, it will appear here.
      </p>
    </Card>
  );
}
