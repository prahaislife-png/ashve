import "server-only";
import ExcelJS from "exceljs";
import { Brand, Collection, Product } from "./schema";
import { cmToIn, currencyOf, Units } from "./locale";
import { lineRows, margin, paletteIndex, summarize } from "./collectionMath";
import { packSlug } from "./excel";

const HEAD: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF2F7" } };
const LINE: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD9DEE7" } };

function header(ws: ExcelJS.Worksheet, row: number, cols: string[]) {
  const r = ws.getRow(row);
  cols.forEach((h, i) => {
    const c = r.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FF3A4150" } };
    c.fill = HEAD;
    c.border = { bottom: LINE };
    c.alignment = { vertical: "middle", wrapText: true };
  });
}

function title(ws: ExcelJS.Worksheet, c: Collection, brand: Brand, sub: string) {
  ws.getCell("A1").value = `${brand.name ? `${brand.name}  ` : ""}${c.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = [sub, c.season, c.launchDate && `Launch ${c.launchDate}`].filter(Boolean).join("   |   ");
  ws.getCell("A2").font = { color: { argb: "FF6B7280" } };
}

/** The whole collection in one workbook: line list, colour matrix, size charts, BOMs and the fabric library. */
export async function buildCollectionWorkbook(c: Collection, products: Product[], brand: Brand, units: Units): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.name || "Tech Pack Studio";
  const cur = currencyOf(brand.currency);
  const pieces = products.map(summarize);
  const rows = lineRows(c, pieces);

  /* Line list */
  const ll = wb.addWorksheet("Line list", { views: [{ state: "frozen", ySplit: 4 }] });
  title(ll, c, brand, "Line list");
  header(ll, 4, ["#", "Style no.", "Style", "Category", "Fabric", "GSM", "Colourways", "Sizes", `Factory cost (${cur.code})`, `Retail (${cur.code})`, "Margin %", "MOQ / colour", "Status", "Last sample"]);
  rows.forEach((r, i) => {
    const p = r.piece;
    const row = ll.getRow(5 + i);
    row.values = [
      i + 1,
      p?.styleNumber ?? "",
      r.name,
      r.category,
      p?.fabric ?? "",
      p?.gsm ?? "",
      r.colorways.map((x) => x.name).join(", "),
      p?.sizes.join(" ") ?? c.sizes,
      r.cost ?? "",
      r.retail ?? "",
      margin(r.cost, r.retail) ?? "",
      p?.moq ?? "",
      p ? p.status : "Idea",
      p?.lastSample ? `Round ${p.lastSample.n} ${p.lastSample.stage}${p.lastSample.verdict ? `, ${p.lastSample.verdict}` : ""}` : "",
    ];
    row.eachCell((cell) => (cell.border = { bottom: LINE }));
  });
  [5, 12, 30, 18, 30, 7, 28, 16, 14, 12, 10, 12, 11, 22].forEach((w, i) => (ll.getColumn(i + 1).width = w));

  /* Colour matrix */
  const cm = wb.addWorksheet("Colour matrix");
  title(cm, c, brand, "Which piece comes in which colour");
  header(cm, 4, ["Style", ...c.palette.map((p) => p.name || p.hex), "Other colours"]);
  c.palette.forEach((p, i) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(p.hex)?.[1];
    if (hex) cm.getRow(3).getCell(i + 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex.toUpperCase()}` } };
  });
  rows.forEach((r, i) => {
    const row = cm.getRow(5 + i);
    row.getCell(1).value = r.name;
    const idx = r.colorways.map((cw) => paletteIndex(c.palette, cw));
    c.palette.forEach((_, j) => {
      row.getCell(j + 2).value = idx.includes(j) ? "●" : "";
      row.getCell(j + 2).alignment = { horizontal: "center" };
    });
    row.getCell(c.palette.length + 2).value = r.colorways.filter((_, k) => idx[k] < 0).map((x) => x.name).join(", ");
  });
  cm.getColumn(1).width = 30;
  for (let i = 2; i <= c.palette.length + 1; i++) cm.getColumn(i).width = 12;
  cm.getColumn(c.palette.length + 2).width = 26;

  /* Size charts, one block per piece */
  const sc = wb.addWorksheet("Size charts");
  title(sc, c, brand, units === "in" ? "Points of measure, in inches" : "Points of measure, in cm");
  let at = 4;
  for (const p of products) {
    const tp = p.techPack;
    if (!tp) continue;
    sc.getCell(`A${at}`).value = `${tp.styleName}${tp.styleNumber ? `  (${tp.styleNumber})` : ""}`;
    sc.getCell(`A${at}`).font = { bold: true, size: 12 };
    header(sc, at + 1, ["Code", "Point of measure", "Tol ±", ...tp.sizes]);
    tp.measurements.forEach((m, i) => {
      const row = sc.getRow(at + 2 + i);
      const conv = (v: number | null) => (v == null ? "" : units === "in" ? cmToIn(v) : v);
      row.values = [m.code, m.name, conv(m.toleranceCm), ...m.values.map(conv)];
      for (let k = 3; k <= 3 + tp.sizes.length; k++) row.getCell(k).numFmt = units === "in" ? "# ?/8" : "0.0";
    });
    at += tp.measurements.length + 4;
  }
  sc.getColumn(1).width = 8;
  sc.getColumn(2).width = 34;

  /* Bill of materials */
  const bom = wb.addWorksheet("Bill of materials");
  title(bom, c, brand, "Fabrics and trims across the collection");
  header(bom, 4, ["Style", "Type", "Item / placement", "Composition / description", "Construction", "GSM / qty"]);
  let r = 5;
  for (const p of products) {
    const tp = p.techPack;
    if (!tp) continue;
    for (const f of tp.fabrics) bom.getRow(r++).values = [tp.styleName, "Fabric", f.placement, f.composition, f.construction, f.weightGsm ?? ""];
    for (const t of tp.trims) bom.getRow(r++).values = [tp.styleName, "Trim", t.item, t.description, "", t.quantity];
  }
  [28, 9, 24, 40, 20, 14].forEach((w, i) => (bom.getColumn(i + 1).width = w));

  /* Fabric library */
  if (c.fabrics.length) {
    const fl = wb.addWorksheet("Fabric library");
    title(fl, c, brand, "Shared fabrics");
    header(fl, 4, ["Name", "Composition", "Construction", "GSM", "Supplier", `Price per metre (${cur.code})`, "Notes"]);
    c.fabrics.forEach((f, i) => (fl.getRow(5 + i).values = [f.name, f.composition, f.construction, f.weightGsm ?? "", f.supplier, f.pricePerM ?? "", f.notes]));
    [22, 30, 20, 8, 26, 16, 40].forEach((w, i) => (fl.getColumn(i + 1).width = w));
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function collectionSlug(c: Collection) {
  return (c.name || "collection").replace(/[^\w-]+/g, "_").slice(0, 60);
}

export { packSlug };
