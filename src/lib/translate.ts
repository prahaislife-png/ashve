import type { TechPack, Translation } from "./schema";

/**
 * Factory-language tech packs. The English tech pack stays the master: we
 * translate its text (and the document's own headings) into a lookup table,
 * and the PDF shows each line in the factory's language with the English under it.
 */

/** Headings and labels the printed documents use. */
export const DOC_LABELS = [
  "Tech pack",
  "Style no.",
  "Category",
  "Sub-category",
  "Season",
  "Designer",
  "Issued",
  "Revision",
  "Product summary",
  "Product type",
  "Fit",
  "Intended use",
  "Target market",
  "Sizes",
  "Sample size",
  "Est. weight",
  "Pattern",
  "Colourway",
  "Secondary colours",
  "Bill of materials",
  "Component",
  "Material",
  "Spec",
  "Flat sketches",
  "Technical flats drawn to the sample size",
  "Coloured sketch",
  "Front",
  "Back",
  "Side",
  "Points of measurement",
  "Each code marks a dimension on the measurement guide.",
  "All measures in cm.",
  "All measures in inches.",
  "Point of measure",
  "How to measure",
  "Tolerance",
  "Status",
  "Verified",
  "To confirm",
  "Graded",
  "Edited",
  "Construction & details",
  "Detail callouts",
  "Care",
  "Costing targets",
  "Factory cost",
  "Retail",
  "Order size per colour",
  "Open points to confirm with the factory",
  "Prints, labels & packaging",
  "Print specs",
  "Seamless repeat",
  "Placement",
  "Product label",
  "Hang tag",
  "Position",
  "Labels & packaging spec",
  "Reference images",
  "Designer approval",
  "Factory approval",
  "Date",
  "Confidential",
  "Fit comments",
  "Sample",
  "Vendor",
  "Received",
  "Requested",
  "Measured",
  "Spec",
  "Difference",
  "Within tolerance",
  "Out of tolerance",
  "Comment",
  "Area",
  "Major",
  "Minor",
  "Overall",
  "Verdict",
  "Approved",
  "Revise and resubmit",
  "Rejected",
  "Sample photos",
] as const;

const SKIP_KEYS = new Set(["hex", "pantone", "code", "styleNumber", "sizes", "baseSize"]);

/** Every piece of English text in a tech pack that a factory reads. */
export function techPackStrings(tp: TechPack): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, key?: string) => {
    if (key && SKIP_KEYS.has(key)) return;
    if (typeof v === "string") {
      const s = v.trim();
      // Skip empty strings, bare numbers and codes.
      if (s && /[A-Za-z]{2}/.test(s)) out.add(s);
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x, key === "sizes" ? key : undefined));
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  walk(tp);
  return [...out];
}

/** A short fingerprint of the tech pack text, to tell when a translation is out of date. */
export function fingerprint(tp: TechPack): string {
  const s = JSON.stringify(techPackStrings(tp));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Look-up function for printed documents: returns the translation, or null for English. */
export function translator(tr: Translation | null | undefined) {
  return (en: string | null | undefined): string | null => {
    if (!tr || !en) return null;
    const k = en.trim();
    return tr.strings[k] ?? null;
  };
}

export type T = ReturnType<typeof translator>;
