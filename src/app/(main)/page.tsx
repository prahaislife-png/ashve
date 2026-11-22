import { getBrand } from "@/lib/store";
import CreateBox from "@/components/CreateBox";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const brand = await getBrand();
  const hasBrand = !!(brand.name || brand.aesthetic || brand.fabrics);
  return (
    <div className="canvas-dots flex min-h-[calc(100vh-1px)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="h-title text-3xl sm:text-4xl">
          What are we making today{brand.name ? `, ${brand.name}` : ""}?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Run the whole product development here, from first idea to tech pack, flats and the
          factory hand-off.
        </p>
        <CreateBox hasBrand={hasBrand} />
      </div>
    </div>
  );
}
