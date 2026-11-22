import JSZip from "jszip";
import { getProduct } from "@/lib/store";
import { readImage } from "@/lib/files";
import { MOCKUP_VIEWS, TechPack } from "@/lib/schema";

type Ctx = { params: Promise<{ id: string }> };

function csv(tp: TechPack) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Code", "Point of measure", "How to measure", "Tolerance ±", ...tp.sizes],
    ...tp.measurements.map((m) => [m.code, m.name, m.howToMeasure, m.toleranceCm, ...m.values]),
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

function bomCsv(tp: TechPack) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows: (string | number | null)[][] = [["Type", "Item / placement", "Description", "Placement", "Qty / weight"]];
  for (const f of tp.fabrics) rows.push(["Fabric", f.placement, `${f.composition} ${f.construction} ${f.finish}`, f.placement, f.weightGsm ? `${f.weightGsm} GSM` : ""]);
  for (const t of tp.trims) rows.push(["Trim", t.item, t.description, t.placement, t.quantity]);
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Download every file for the factory in one ZIP. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);
  if (!product?.techPack) return new Response("Not found", { status: 404 });
  const tp = product.techPack;
  const slug = (tp.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : product.name)
    .replace(/[^\w-]+/g, "_")
    .slice(0, 60);

  const zip = new JSZip();
  const root = zip.folder(slug)!;
  root.file(
    "README.txt",
    [
      `${tp.styleName}`,
      "",
      "Contents:",
      "- measurements.csv: size chart (cm) with tolerances",
      "- bill-of-materials.csv: fabrics and trims",
      "- tech-pack.json: full specification data",
      "- flats/: front, back, measurement guide, technical and coloured sketches (SVG)",
      "- images/: product views and mockups",
      "- details/, prints/, labels/: detail close-ups, print files and label artwork",
      "",
      "The tech pack PDF is made from the app: Hand off > Download PDF > Save as PDF.",
    ].join("\r\n"),
  );
  root.file("measurements.csv", csv(tp));
  root.file("bill-of-materials.csv", bomCsv(tp));
  root.file("tech-pack.json", JSON.stringify(tp, null, 2));

  const add = async (folder: string, name: string, file: string | null | undefined) => {
    if (!file) return;
    const img = await readImage(id, file);
    if (img) root.folder(folder)!.file(`${name}.${file.split(".").pop()}`, img.buffer);
  };

  const set = product.flats?.at(-1);
  if (set) {
    await add("flats", "front", set.front);
    await add("flats", "back", set.back);
    await add("flats", "measurement-guide", set.measurementGuide);
    await add("flats", "technical-sketch", set.technical);
  }
  let i = 0;
  for (const m of product.mockups ?? []) {
    i++;
    await add("images", `${String(i).padStart(2, "0")}-${MOCKUP_VIEWS[m.view].replace(/[^\w]+/g, "-")}-${m.colorway}`, m.file);
  }
  for (const pin of product.details ?? []) {
    await add("details", `${pin.n}-${pin.title.replace(/[^\w]+/g, "-")}`, pin.closeup);
  }
  for (const pr of product.prints ?? []) {
    await add("prints", pr.name.replace(/[^\w]+/g, "-"), pr.file);
  }
  await add("labels", "product-label", product.labels?.product.file);
  await add("labels", "hang-tag", product.labels?.hangTag.file);

  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-factory-pack.zip"`,
    },
  });
}
