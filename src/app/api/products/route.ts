import { NextResponse } from "next/server";
import { createProduct, listProducts } from "@/lib/store";

export async function GET() {
  const products = await listProducts();
  return NextResponse.json(
    products.map(({ id, name, status, updatedAt, techPack }) => ({
      id,
      name,
      status,
      updatedAt,
      category: techPack?.category ?? null,
    })),
  );
}

export async function POST(req: Request) {
  const { name, useBrand } = (await req.json()) as { name?: string; useBrand?: boolean };
  const product = await createProduct(String(name ?? ""), useBrand !== false);
  return NextResponse.json(product, { status: 201 });
}
