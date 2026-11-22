import { z } from "zod/v4";

/* ---------- Tech pack (what Claude fills in) ---------- */

const Fabric = z.object({
  placement: z.string().describe("Where it is used, e.g. 'Body', 'Waistband', 'Neck binding'"),
  composition: z.string().describe("Fibre content, e.g. '95% modal / 5% elastane'"),
  construction: z.string().describe("Knit/weave, e.g. 'Single jersey', '1x1 rib', 'French terry'"),
  weightGsm: z.number().nullable(),
  finish: z.string().describe("e.g. 'Brushed', 'Enzyme wash', 'Peached', or 'None'"),
  notes: z.string(),
});

const Colorway = z.object({
  name: z.string(),
  pantone: z.string().describe("Pantone TCX/TPG code if known, else ''"),
  hex: z.string().describe("Approximate hex like '#A3B18A'"),
});

const Trim = z.object({
  item: z.string(),
  description: z.string(),
  placement: z.string(),
  quantity: z.string(),
});

const ConstructionStep = z.object({
  area: z.string().describe("e.g. 'Side seams', 'Hem', 'Waistband'"),
  method: z.string().describe("Stitch type and spec, e.g. '4-thread overlock (ISO 514), 12 SPI'"),
});

const Measurement = z.object({
  code: z.string().describe("Point of measure code, e.g. 'A', 'B'"),
  name: z.string(),
  howToMeasure: z.string(),
  toleranceCm: z.number(),
  values: z
    .array(z.number().nullable())
    .describe("One value in cm per size, in the same order as `sizes`"),
});

const LabelItem = z.object({ item: z.string(), details: z.string() });

export const TechPackSchema = z.object({
  styleName: z.string(),
  styleNumber: z.string(),
  category: z.string().describe("e.g. 'Loungewear'"),
  subcategory: z.string().describe("e.g. 'Matching sets / Top and pant sets'"),
  productType: z.string().describe("One line, e.g. 'Tie-strap crop camisole and wide-leg pant set'"),
  season: z.string(),
  description: z.string(),
  fit: z.string(),
  intendedUse: z.string().describe("When and how she wears it"),
  targetMarket: z.string().describe("Who it is for and at what price level"),
  estimatedWeightG: z.number().nullable().describe("Estimated finished weight of the whole product in grams, size M"),
  pattern: z.string().describe("Print/pattern/texture, e.g. 'Solid', 'Crinkle texture', 'Ditsy floral all-over print'"),
  sizes: z.array(z.string()),
  baseSize: z.string(),
  fabrics: z.array(Fabric),
  colorways: z.array(Colorway),
  accentColors: z.array(Colorway).describe("Colours of trims, hardware, threads, labels"),
  trims: z.array(Trim),
  construction: z.array(ConstructionStep),
  measurements: z.array(Measurement),
  labelsPackaging: z.array(LabelItem),
  careInstructions: z.array(z.string()),
  costing: z.object({
    targetFobUsd: z.number().nullable(),
    targetRetailUsd: z.number().nullable(),
    moqPerColor: z.number().nullable(),
  }),
  openQuestions: z
    .array(z.string())
    .describe("Decisions the designer still needs to make before sending to a factory"),
});

export type TechPack = z.infer<typeof TechPackSchema>;

/** Fill fields added in later versions so older saved tech packs still work. */
export function normalizeTechPack(tp: Partial<TechPack> | null | undefined): TechPack | null {
  if (!tp) return null;
  return {
    styleName: "",
    styleNumber: "",
    category: "",
    subcategory: "",
    productType: "",
    season: "",
    description: "",
    fit: "",
    intendedUse: "",
    targetMarket: "",
    estimatedWeightG: null,
    pattern: "",
    sizes: [],
    baseSize: "",
    fabrics: [],
    colorways: [],
    accentColors: [],
    trims: [],
    construction: [],
    measurements: [],
    labelsPackaging: [],
    careInstructions: [],
    costing: { targetFobUsd: null, targetRetailUsd: null, moqPerColor: null },
    openQuestions: [],
    ...tp,
  } as TechPack;
}

/*
 * The shape Claude fills in. It is deliberately simpler than TechPack (no nullable
 * fields, one colour list) so the structured-output grammar stays small; `fromWire`
 * converts it back. Use 0 for "unknown" numbers.
 */
const WireColor = Colorway.extend({
  role: z.string().describe("'main' for a colourway, 'accent' for trims, hardware, thread, labels"),
});

const TechPackWireSchema = TechPackSchema.omit({
  accentColors: true,
  colorways: true,
  costing: true,
  estimatedWeightG: true,
  fabrics: true,
  measurements: true,
}).extend({
  colors: z.array(WireColor),
  estimatedWeightG: z.number().describe("Grams, size M. 0 if unknown"),
  targetFobUsd: z.number().describe("0 if unknown"),
  targetRetailUsd: z.number().describe("0 if unknown"),
  moqPerColor: z.number().describe("0 if unknown"),
  fabrics: z.array(Fabric.extend({ weightGsm: z.number().describe("0 if unknown") })),
  measurements: z.array(
    Measurement.extend({
      values: z.array(z.number()).describe("One value in cm per size, in the same order as `sizes`"),
    }),
  ),
});

export const AssistantTurnWireSchema = z.object({
  reply: z
    .string()
    .describe("Short, friendly message to the designer: what changed and up to 3 questions"),
  techPack: TechPackWireSchema,
});

type TechPackWire = z.infer<typeof TechPackWireSchema>;

export function fromWire(w: TechPackWire): TechPack {
  const { colors, targetFobUsd, targetRetailUsd, moqPerColor, ...rest } = w;
  const nz = (n: number) => (n && n > 0 ? n : null);
  const strip = ({ name, pantone, hex }: z.infer<typeof WireColor>) => ({ name, pantone, hex });
  return {
    ...rest,
    colorways: colors.filter((c) => !/accent/i.test(c.role)).map(strip),
    accentColors: colors.filter((c) => /accent/i.test(c.role)).map(strip),
    estimatedWeightG: nz(w.estimatedWeightG),
    costing: { targetFobUsd: nz(targetFobUsd), targetRetailUsd: nz(targetRetailUsd), moqPerColor: nz(moqPerColor) },
    fabrics: w.fabrics.map((f) => ({ ...f, weightGsm: nz(f.weightGsm) })),
    measurements: w.measurements.map((m) => ({ ...m, values: m.values.map((v) => (v > 0 ? v : null)) })),
  };
}

export type AssistantTurn = { reply: string; techPack: TechPack };

/* ---------- Brand DNA (what she fills in) ---------- */

export type Brand = {
  name: string;
  aesthetic: string;
  customer: string;
  palette: { name: string; pantone: string; hex: string }[];
  fabrics: string;
  sizes: string;
  baseSize: string;
  baseMeasurements: string;
  fitNotes: string;
  labelNotes: string;
  packagingNotes: string;
  targetFobUsd: string;
  targetRetailUsd: string;
  moqPerColor: string;
};

export const emptyBrand: Brand = {
  name: "",
  aesthetic: "",
  customer: "",
  palette: [],
  fabrics: "",
  sizes: "XS, S, M, L, XL",
  baseSize: "M",
  baseMeasurements: "",
  fitNotes: "",
  labelNotes: "",
  packagingNotes: "",
  targetFobUsd: "",
  targetRetailUsd: "",
  moqPerColor: "",
};

/* ---------- Product (stored) ---------- */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: string;
  /** File names of reference photos attached to this message (stored in data/uploads/<productId>/) */
  images?: string[];
};

export type ProductStatus = "draft" | "sampling" | "approved";

export const MOCKUP_VIEWS = {
  "product-front": "Product – front",
  "product-side": "Product – side",
  "product-back": "Product – back",
  "flat-front": "Flat lay – front",
  "flat-back": "Flat lay – back",
  "on-model": "On model",
  lifestyle: "Lifestyle",
  detail: "Close-up detail",
} as const;

export type MockupView = keyof typeof MOCKUP_VIEWS;

export const PRODUCT_VIEWS = ["product-front", "product-side", "product-back"] as const;

export type Mockup = {
  id: string;
  file: string;
  view: MockupView;
  colorway: string;
  note: string;
  /** Set when this image was made by editing another mockup */
  editedFrom: string | null;
  inPdf: boolean;
  at: string;
};

export type FlatSet = {
  id: string;
  front: string;
  back: string;
  measurementGuide: string;
  /** Front flat with numbered construction callouts (made separately) */
  technical?: string | null;
  technicalNotes?: { n: number; title: string; detail: string }[];
  note: string;
  at: string;
};

/** A numbered pin on a product image pointing at a detail (seam, trim, label...). */
export type DetailPin = {
  id: string;
  n: number;
  /** The mockup file the pin sits on */
  image: string;
  x: number; // 0–100 % from left
  y: number; // 0–100 % from top
  title: string;
  note: string;
  /** Optional AI close-up of this detail */
  closeup: string | null;
  at: string;
};

export type PrintFile = {
  id: string;
  file: string;
  kind: "repeat" | "placement";
  name: string;
  placement: string;
  widthCm: number | null;
  heightCm: number | null;
  note: string;
  source: "ai" | "upload";
  at: string;
};

export type LabelSlot = {
  file: string | null;
  position: string;
  notes: string;
  source: "ai" | "upload" | null;
};

export type Labels = { product: LabelSlot; hangTag: LabelSlot };

export const emptyLabels: Labels = {
  product: { file: null, position: "Inside back neck", notes: "", source: null },
  hangTag: { file: null, position: "Front loop", notes: "", source: null },
};

export type Product = {
  id: string;
  name: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  techPack: TechPack | null;
  messages: ChatMessage[];
  revisions: { at: string; techPack: TechPack }[];
  mockups?: Mockup[];
  /** Technical flat drawing sets. The last one is the current set used in the PDF. */
  flats?: FlatSet[];
  details?: DetailPin[];
  prints?: PrintFile[];
  labels?: Labels;
  /** Whether Brand DNA was applied when this product was created */
  useBrand?: boolean;
  /** Last drafted factory email */
  rfq?: { subject: string; body: string; at: string } | null;
};

export const FlatDrawingSchema = z.object({
  front: z.string().describe("Complete standalone SVG document: front technical flat"),
  back: z.string().describe("Complete standalone SVG document: back technical flat"),
  measurementGuide: z
    .string()
    .describe("Complete standalone SVG document: front flat in grey with labelled point-of-measure lines"),
  notes: z.string().describe("One or two sentences for the designer about the drawings"),
});

export type FlatDrawing = z.infer<typeof FlatDrawingSchema>;

export const TechnicalSketchSchema = z.object({
  svg: z.string().describe("Complete standalone SVG: front flat with numbered construction callouts"),
  callouts: z
    .array(z.object({ n: z.number(), title: z.string(), detail: z.string() }))
    .describe("One entry per numbered callout on the drawing, in order"),
});

export type TechnicalSketch = z.infer<typeof TechnicalSketchSchema>;

export const RfqSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Plain-text email to a factory asking for a sample quote"),
});

export const DetailSuggestSchema = z.object({
  details: z
    .array(
      z.object({
        title: z.string(),
        note: z.string().describe("Spec note for the factory, e.g. stitch, size, finish"),
        x: z.number().describe("0-100, % from left of the image"),
        y: z.number().describe("0-100, % from top of the image"),
      }),
    )
    .describe("4 to 8 key construction/trim details visible on the product image"),
});

/* ---------- Outputs / completeness ---------- */

export type OutputKey = "basic" | "flats" | "details" | "print" | "labels";

export const OUTPUTS: { key: OutputKey; label: string }[] = [
  { key: "basic", label: "Basic product specs" },
  { key: "flats", label: "Flat sketches" },
  { key: "details", label: "Detailed specs" },
  { key: "print", label: "Print files" },
  { key: "labels", label: "Labels and tags" },
];

export function productViews(p: Product) {
  const out: Partial<Record<(typeof PRODUCT_VIEWS)[number], Mockup>> = {};
  for (const m of p.mockups ?? []) {
    if ((PRODUCT_VIEWS as readonly string[]).includes(m.view)) {
      out[m.view as (typeof PRODUCT_VIEWS)[number]] = m; // latest wins
    }
  }
  return out;
}

export function outputStatus(p: Product): Record<OutputKey, boolean> {
  const flats = p.flats?.at(-1);
  const isSolid = /^(solid|plain|none|crinkle|texture|rib)/i.test(p.techPack?.pattern ?? "solid");
  return {
    basic: !!p.techPack && !!productViews(p)["product-front"],
    flats: !!flats,
    details: (p.details?.length ?? 0) > 0,
    print: (p.prints?.length ?? 0) > 0 || isSolid,
    labels: !!(p.labels?.product.file && p.labels?.hangTag.file),
  };
}
