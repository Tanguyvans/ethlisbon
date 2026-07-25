import { notFound } from "next/navigation";
import { getToken, listEvents, listHolders } from "@/lib/db/repo";
import TokenWorkspace from "@/components/TokenWorkspace";

export const dynamic = "force-dynamic";

export default async function TokenDetailPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const token = getToken(tokenId);
  if (!token) notFound();

  const holders = listHolders(tokenId);
  const events = listEvents(tokenId);

  return <TokenWorkspace token={token} holders={holders} events={events} />;
}
