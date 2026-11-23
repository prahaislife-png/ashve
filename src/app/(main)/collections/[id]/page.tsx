import { notFound } from "next/navigation";
import { collectionProducts, getCollection } from "@/lib/collections";
import { summarize } from "@/lib/collectionMath";
import CollectionBoard from "@/components/collections/CollectionBoard";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) notFound();
  const pieces = (await collectionProducts(c)).map(summarize);
  return <CollectionBoard initial={{ collection: c, pieces }} />;
}
