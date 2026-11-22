import { notFound } from "next/navigation";
import { getBrand, getProduct } from "@/lib/store";
import PrintButton from "@/components/PrintButton";
import TechPackDocument from "@/components/TechPackDocument";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, brand] = await Promise.all([getProduct(id).catch(() => null), getBrand()]);
  if (!product?.techPack) notFound();
  return (
    <TechPackDocument
      product={product}
      brand={brand}
      base={`/api/products/${product.id}`}
      toolbar={
        <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-accent-soft p-3 text-sm">
          <span>In the print window choose “Save as PDF”. Turn on “Background graphics” for colour swatches.</span>
          <PrintButton />
        </div>
      }
    />
  );
}
