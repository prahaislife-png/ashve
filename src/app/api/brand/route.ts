import { NextResponse } from "next/server";
import { getBrand, saveBrand } from "@/lib/store";
import { Brand, emptyBrand } from "@/lib/schema";

export async function GET() {
  return NextResponse.json(await getBrand());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Brand>;
  const brand: Brand = { ...emptyBrand };
  for (const key of Object.keys(emptyBrand) as (keyof Brand)[]) {
    if (key === "palette") {
      brand.palette = Array.isArray(body.palette)
        ? body.palette.map((c) => ({
            name: String(c?.name ?? ""),
            pantone: String(c?.pantone ?? ""),
            hex: String(c?.hex ?? ""),
          }))
        : [];
    } else if (typeof body[key] === "string") {
      (brand[key] as string) = body[key] as string;
    }
  }
  await saveBrand(brand);
  return NextResponse.json(brand);
}

/** Change a few text settings (e.g. units from the size chart) without sending the whole brand. */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Record<keyof Brand, unknown>>;
  const brand = await getBrand();
  for (const key of Object.keys(emptyBrand) as (keyof Brand)[]) {
    if (key !== "palette" && typeof body[key] === "string") (brand[key] as string) = (body[key] as string).slice(0, 4000);
  }
  await saveBrand(brand);
  return NextResponse.json(brand);
}
