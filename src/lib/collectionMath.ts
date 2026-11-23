import type { Collection, PlanItem, Product, SampleRound } from "./schema";
import { outputStatus, OUTPUTS, productViews } from "./schema";

/**
 * What the collection page needs to know about each piece, without sending
 * whole product records (chat history, revisions) to the browser.
 */
export type PieceSummary = {
  id: string;
  name: string;
  status: Product["status"];
  updatedAt: string;
  thumb: string | null;
  hasTechPack: boolean;
  styleName: string;
  styleNumber: string;
  productType: string;
  category: string;
  description: string;
  sizes: string[];
  colorways: { name: string; hex: string; pantone: string }[];
  fabric: string;
  gsm: number | null;
  cost: number | null;
  retail: number | null;
  moq: number | null;
  openDecisions: number;
  outputsDone: number;
  outputsTotal: number;
  measurementsVerified: number;
  measurementsTotal: number;
  lastSample: { n: number; stage: SampleRound["stage"]; status: SampleRound["status"]; verdict: SampleRound["verdict"] } | null;
  shareToken: string | null;
};

export function summarize(p: Product): PieceSummary {
  const tp = p.techPack;
  const status = outputStatus(p);
  const last = p.samples?.at(-1);
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    updatedAt: p.updatedAt,
    thumb: productViews(p)["product-front"]?.file ?? null,
    hasTechPack: !!tp,
    styleName: tp?.styleName || p.name,
    styleNumber: tp?.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : "",
    productType: tp?.productType ?? "",
    category: tp?.subcategory || tp?.category || "",
    description: tp?.description ?? "",
    sizes: tp?.sizes ?? [],
    colorways: tp?.colorways ?? [],
    fabric: tp?.fabrics[0] ? `${tp.fabrics[0].composition} ${tp.fabrics[0].construction}`.trim() : "",
    gsm: tp?.fabrics[0]?.weightGsm ?? null,
    cost: tp?.costing.targetFobUsd ?? null,
    retail: tp?.costing.targetRetailUsd ?? null,
    moq: tp?.costing.moqPerColor ?? null,
    openDecisions: tp?.openQuestions.length ?? 0,
    outputsDone: OUTPUTS.filter((o) => status[o.key]).length,
    outputsTotal: OUTPUTS.length,
    measurementsVerified: tp ? tp.measurements.filter((m) => p.measureMeta?.[m.code]?.verified).length : 0,
    measurementsTotal: tp?.measurements.length ?? 0,
    lastSample: last ? { n: last.n, stage: last.stage, status: last.status, verdict: last.verdict } : null,
    shareToken: p.share?.token ?? null,
  };
}

/* ---------- colour matching ---------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function hexDist(a: string, b: string) {
  const p = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a);
  const y = p(b);
  if (!x || !y) return Infinity;
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
}

/** Which palette colour a piece's colourway is (same name, or a very close hex), or -1. */
export function paletteIndex(palette: Collection["palette"], c: { name: string; hex: string }) {
  const n = norm(c.name);
  const byName = palette.findIndex((p) => p.name && (norm(p.name) === n || n.includes(norm(p.name))));
  if (byName >= 0) return byName;
  let best = -1;
  let bestD = 28; // close enough to be the same dye
  palette.forEach((p, i) => {
    const d = hexDist(p.hex, c.hex);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ---------- line plan rows ---------- */

export type LineRow = {
  plan: PlanItem | null;
  piece: PieceSummary | null;
  name: string;
  category: string;
  colorways: { name: string; hex: string }[];
  cost: number | null;
  retail: number | null;
};

/** Plan slots joined to their products, plus pieces added to the collection outside the plan. */
export function lineRows(c: Collection, pieces: PieceSummary[]): LineRow[] {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const used = new Set<string>();
  const rows: LineRow[] = c.plan.map((plan) => {
    const piece = plan.productId ? byId.get(plan.productId) ?? null : null;
    if (piece) used.add(piece.id);
    const fromPalette = plan.colorways
      .map((n) => c.palette.find((p) => p.name === n))
      .filter((x): x is Collection["palette"][number] => !!x);
    return {
      plan,
      piece,
      name: piece?.styleName || plan.name,
      category: piece?.category || plan.category,
      colorways: piece?.hasTechPack && piece.colorways.length ? piece.colorways : fromPalette,
      cost: piece?.cost ?? plan.targetCost,
      retail: piece?.retail ?? plan.targetRetail,
    };
  });
  for (const p of pieces)
    if (!used.has(p.id))
      rows.push({ plan: null, piece: p, name: p.styleName, category: p.category, colorways: p.colorways, cost: p.cost, retail: p.retail });
  return rows;
}

export const margin = (cost: number | null, retail: number | null) =>
  cost != null && retail != null && retail > 0 ? Math.round(((retail - cost) / retail) * 100) : null;

/* ---------- checks ---------- */

export type Check = { level: "warn" | "info"; text: string; pieceId?: string };

/** Things that make a collection feel inconsistent or not ready, worked out from the data (no AI). */
export function collectionChecks(c: Collection, rows: LineRow[]): Check[] {
  const out: Check[] = [];
  const sizes = c.sizes
    .split(/[,/\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const libWords = c.fabrics.map((f) => norm(`${f.name} ${f.composition} ${f.construction}`));

  for (const r of rows) {
    const p = r.piece;
    if (!p) continue;
    if (!p.hasTechPack) {
      out.push({ level: "info", text: `${r.name} has no tech pack yet.`, pieceId: p.id });
      continue;
    }
    const outside = p.colorways.filter((cw) => c.palette.length && paletteIndex(c.palette, cw) < 0);
    if (outside.length)
      out.push({ level: "warn", text: `${r.name} uses ${outside.map((x) => x.name).join(", ")}, outside the collection palette.`, pieceId: p.id });
    if (sizes.length && p.sizes.length && p.sizes.map((s) => s.toUpperCase()).join() !== sizes.join())
      out.push({ level: "warn", text: `${r.name} is sized ${p.sizes.join("/")}, the collection is ${sizes.join("/")}.`, pieceId: p.id });
    if (libWords.length && p.fabric) {
      const f = norm(p.fabric);
      const known = libWords.some((w) => w.split(" ").filter((x) => x.length > 3).some((x) => f.includes(x)));
      if (!known) out.push({ level: "info", text: `${r.name} is in ${p.fabric}, which isn't in the collection's fabric library.`, pieceId: p.id });
    }
    if (!p.styleNumber) out.push({ level: "info", text: `${r.name} has no style number.`, pieceId: p.id });
    if (p.openDecisions) out.push({ level: "info", text: `${r.name} has ${p.openDecisions} open decision${p.openDecisions > 1 ? "s" : ""}.`, pieceId: p.id });
    const m = margin(r.cost, r.retail);
    if (m != null && m < 50) out.push({ level: "warn", text: `${r.name} has a ${m}% margin at the target prices.`, pieceId: p.id });
  }

  const unused = c.palette.filter((pc, i) => !rows.some((r) => r.colorways.some((cw) => paletteIndex(c.palette, cw) === i)));
  if (rows.length && unused.length) out.push({ level: "info", text: `No piece uses ${unused.map((u) => u.name).join(", ")} yet.` });
  if (c.targetPieces && rows.length < c.targetPieces)
    out.push({ level: "info", text: `${rows.length} of ${c.targetPieces} planned pieces are in the line plan.` });
  return out;
}

/** Countdown to launch, in days (negative once launched). */
export function daysToLaunch(c: Collection) {
  if (!c.launchDate) return null;
  const d = new Date(`${c.launchDate}T00:00:00`);
  return Math.ceil((d.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
}
