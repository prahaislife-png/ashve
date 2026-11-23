import "server-only";
import ExcelJS from "exceljs";
import { Brand, metaFor, Product } from "./schema";
import { cmToIn, currencyOf, money, Units } from "./locale";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF2F7" } };
const SAMPLE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEFB" } };
const CHECK_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF3DC" } };
const LINE: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD9DEE7" } };

function table(ws: ExcelJS.Worksheet, startRow: number, headers: string[], rows: (string | number | null)[][]) {
  const head = ws.getRow(startRow);
  headers.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FF3A4150" } };
    c.fill = HEADER_FILL;
    c.border = { bottom: LINE };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + 1 + ri);
    r.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = v ?? "";
      c.border = { bottom: LINE };
      c.alignment = { vertical: "top", wrapText: typeof v === "string" && v.length > 30 };
    });
  });
}

function titleBlock(ws: ExcelJS.Worksheet, product: Product, brand: Brand, sheetTitle: string) {
  const tp = product.techPack!;
  ws.getCell("A1").value = `${brand.name ? `${brand.name}  ` : ""}${tp.styleName}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = sheetTitle;
  ws.getCell("A2").font = { color: { argb: "FF6B7280" } };
  ws.getCell("A3").value = [
    `Style no. ${tp.styleNumber || "TBC"}`,
    `Season ${tp.season || "TBC"}`,
    `Sizes ${tp.sizes.join(" ")} (sample ${tp.baseSize})`,
    `Revision ${product.revisions.length + 1}`,
    `Issued ${new Date(product.updatedAt).toLocaleDateString("en-GB")}`,
  ].join("   |   ");
  ws.getCell("A3").font = { size: 10, color: { argb: "FF6B7280" } };
}

/** The tech pack as an Excel workbook: size chart, BOM, construction, colours, labels and care. */
export async function buildWorkbook(product: Product, brand: Brand, units: Units = "cm"): Promise<Buffer> {
  const u = (v: number | null) => (v == null ? null : units === "in" ? cmToIn(v) : v);
  const tp = product.techPack!;
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.name || "Tech Pack Studio";
  wb.created = new Date();

  /* Size chart */
  const sc = wb.addWorksheet("Size chart", { views: [{ state: "frozen", xSplit: 2, ySplit: 5 }] });
  titleBlock(sc, product, brand, units === "in" ? "Points of measure, in inches" : "Points of measure, in cm");
  const baseIdx = Math.max(0, tp.sizes.indexOf(tp.baseSize));
  const fixed = ["Code", "Point of measure", "How to measure", "Tol ±", "Grade"];
  table(
    sc,
    5,
    [...fixed, ...tp.sizes, "Source", "Verified"],
    tp.measurements.map((m) => {
      const mm = metaFor(product, m.code);
      const source = mm.source === "ai" ? "AI-suggested" : mm.source === "rule" ? "Graded" : "Edited";
      return [m.code, m.name, m.howToMeasure, u(m.toleranceCm), u(mm.grade), ...m.values.map(u), source, mm.verified ? "Yes" : "No"];
    }),
  );
  sc.columns.forEach((col, i) => {
    col.width = i === 0 ? 8 : i === 1 ? 30 : i === 2 ? 44 : i >= fixed.length && i < fixed.length + tp.sizes.length ? 8 : 12;
  });
  tp.measurements.forEach((m, r) => {
    const row = sc.getRow(6 + r);
    const sample = row.getCell(fixed.length + 1 + baseIdx);
    sample.fill = SAMPLE_FILL;
    sample.font = { bold: true };
    const mm = metaFor(product, m.code);
    if (!mm.verified) row.getCell(fixed.length + tp.sizes.length + 2).fill = CHECK_FILL;
    for (let c = 4; c <= fixed.length + tp.sizes.length; c++) row.getCell(c).numFmt = units === "in" ? "# ?/8" : "0.0";
  });
  sc.getRow(5).getCell(fixed.length + 1 + baseIdx).fill = SAMPLE_FILL;

  /* Bill of materials */
  const bom = wb.addWorksheet("Bill of materials", { views: [{ state: "frozen", ySplit: 5 }] });
  titleBlock(bom, product, brand, "Fabrics and trims");
  table(bom, 5, ["Type", "Item / placement", "Composition / description", "Construction", "Weight / qty", "Finish / placement", "Notes"], [
    ...tp.fabrics.map((f) => ["Fabric", f.placement, f.composition, f.construction, f.weightGsm ? `${f.weightGsm} GSM` : "", f.finish, f.notes]),
    ...tp.trims.map((t) => ["Trim", t.item, t.description, "", t.quantity, t.placement, ""]),
  ]);
  [10, 26, 40, 22, 14, 24, 40].forEach((w, i) => (bom.getColumn(i + 1).width = w));

  /* Construction */
  const con = wb.addWorksheet("Construction");
  titleBlock(con, product, brand, "Construction and stitching");
  table(con, 5, ["Area", "Method"], tp.construction.map((c) => [c.area, c.method]));
  con.getColumn(1).width = 28;
  con.getColumn(2).width = 110;
  const set = product.flats?.at(-1);
  if (set?.technicalNotes?.length) {
    const start = 7 + tp.construction.length;
    con.getCell(`A${start}`).value = "Technical sketch callouts";
    con.getCell(`A${start}`).font = { bold: true };
    table(con, start + 1, ["#", "Callout"], set.technicalNotes.map((c) => [c.n, `${c.title}. ${c.detail}`]));
  }

  /* Colours */
  const col = wb.addWorksheet("Colours");
  titleBlock(col, product, brand, "Colourways and trim colours");
  table(col, 5, ["Use", "Name", "Pantone", "Hex"], [
    ...tp.colorways.map((c) => ["Colourway", c.name, c.pantone, c.hex]),
    ...tp.accentColors.map((c) => ["Trim / hardware", c.name, c.pantone, c.hex]),
  ]);
  [18, 30, 18, 12].forEach((w, i) => (col.getColumn(i + 1).width = w));
  [...tp.colorways, ...tp.accentColors].forEach((c, i) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(c.hex)?.[1];
    if (hex) col.getRow(6 + i).getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex.toUpperCase()}` } };
  });

  /* Labels and care */
  const lab = wb.addWorksheet("Labels and care");
  titleBlock(lab, product, brand, "Labels, packaging and care");
  table(lab, 5, ["Item", "Details"], [
    ...tp.labelsPackaging.map((l) => [l.item, l.details]),
    ...tp.careInstructions.map((c) => ["Care", c]),
    ["Product label position", product.labels?.product.position ?? ""],
    ["Hang tag position", product.labels?.hangTag.position ?? ""],
    ["Target factory cost", money(tp.costing.targetFobUsd, brand.currency)],
    ["Target retail price", money(tp.costing.targetRetailUsd, brand.currency)],
    ["Order size per colour", tp.costing.moqPerColor ?? ""],
    ["Currency", currencyOf(brand.currency).label],
  ]);
  lab.getColumn(1).width = 28;
  lab.getColumn(2).width = 100;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function packSlug(product: Product) {
  const tp = product.techPack;
  return ((tp?.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : product.name) || "tech-pack")
    .replace(/[^\w-]+/g, "_")
    .slice(0, 60);
}
