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
