import "server-only";
import JSZip from "jszip";
import { readImage } from "./files";
import { buildWorkbook, packSlug } from "./excel";
import { Brand, metaFor, MOCKUP_VIEWS, Product, TechPack } from "./schema";

function sizeChartCsv(product: Product, tp: TechPack) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Code", "Point of measure", "How to measure", "Tolerance ±", "Grade", ...tp.sizes, "Source", "Verified"],
    ...tp.measurements.map((m) => {
      const mm = metaFor(product, m.code);
      const src = mm.source === "ai" ? "AI-suggested" : mm.source === "rule" ? "Graded" : "Edited";
      return [m.code, m.name, m.howToMeasure, m.toleranceCm, mm.grade, ...m.values, src, mm.verified ? "Yes" : "No"];
    }),
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

/** Every file a factory needs, in one ZIP. */
export async function buildFactoryZip(product: Product, brand: Brand): Promise<{ bytes: Uint8Array; filename: string }> {
  const tp = product.techPack!;
  const slug = packSlug(product);
  const zip = new JSZip();
  const root = zip.folder(slug)!;
  root.file(
    "README.txt",
    [
      tp.styleName,
      "",
      "Contents:",
      "- tech-pack.xlsx: size chart, bill of materials, construction, colours, labels and care",
      "- measurements.csv: size chart (cm) with tolerances, grade steps and verification status",
      "- bill-of-materials.csv: fabrics and trims",
      "- tech-pack.json: full specification data",
      "- flats/: front, back, measurement guide and technical sketch (SVG)",
      "- images/: product views and mockups",
      "- details/, prints/, labels/: detail close-ups, print files and label artwork",
    ].join("\r\n"),
  );
  root.file("tech-pack.xlsx", await buildWorkbook(product, brand));
  root.file("measurements.csv", sizeChartCsv(product, tp));
  root.file("bill-of-materials.csv", bomCsv(tp));
  root.file("tech-pack.json", JSON.stringify(tp, null, 2));

  const add = async (folder: string, name: string, file: string | null | undefined) => {
    if (!file) return;
    const img = await readImage(product.id, file);
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
  for (const pin of product.details ?? []) await add("details", `${pin.n}-${pin.title.replace(/[^\w]+/g, "-")}`, pin.closeup);
  for (const pr of product.prints ?? []) await add("prints", pr.name.replace(/[^\w]+/g, "-"), pr.file);
  await add("labels", "product-label", product.labels?.product.file);
  await add("labels", "hang-tag", product.labels?.hangTag.file);

  return { bytes: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }), filename: `${slug}-factory-pack.zip` };
}
