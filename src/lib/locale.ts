/**
 * Regional choices: currency, measurement units and the language of factory
 * documents. Data is always stored in cm and in English; these only change how
 * it is shown and exported. India-first defaults, every one of them a choice.
 */

/* ---------- currency ---------- */

export const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian rupee (₹)", locale: "en-IN" },
  { code: "USD", symbol: "$", label: "US dollar ($)", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro (€)", locale: "en-IE" },
  { code: "GBP", symbol: "£", label: "British pound (£)", locale: "en-GB" },
  { code: "AED", symbol: "AED ", label: "UAE dirham (AED)", locale: "en-AE" },
  { code: "BDT", symbol: "৳", label: "Bangladeshi taka (৳)", locale: "en-BD" },
  { code: "AUD", symbol: "A$", label: "Australian dollar (A$)", locale: "en-AU" },
  { code: "CAD", symbol: "C$", label: "Canadian dollar (C$)", locale: "en-CA" },
  { code: "SGD", symbol: "S$", label: "Singapore dollar (S$)", locale: "en-SG" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function currencyOf(code: string | undefined) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** ₹1,250 / $12.50. Whole numbers stay whole. */
export function money(n: number | null | undefined, code: string | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const c = currencyOf(code);
  const digits = Number.isInteger(n) ? 0 : 2;
  return `${c.symbol}${n.toLocaleString(c.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/* ---------- units ---------- */

export type Units = "cm" | "in";
export const unitsOf = (u: string | undefined): Units => (u === "in" ? "in" : "cm");

const CM_PER_IN = 2.54;
const FRACTIONS: Record<number, string> = { 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞" };
const ASCII_FRACTIONS: Record<number, string> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" };

/** 83.8 cm → "33". Garment inches are written to the nearest ⅛. */
export function inches(cm: number, ascii = false): string {
  const eighths = Math.round((cm / CM_PER_IN) * 8);
  const whole = Math.trunc(eighths / 8);
  const rest = Math.abs(eighths % 8);
  const frac = rest ? (ascii ? ASCII_FRACTIONS[rest] : FRACTIONS[rest]) : "";
  if (!whole && frac) return `${eighths < 0 ? "-" : ""}${frac}`;
  return ascii && frac ? `${whole} ${frac}` : `${whole}${frac}`;
}

/** A measurement for display: "83.8" (cm) or "33" (in). */
export function measure(cm: number | null | undefined, units: Units, ascii = false): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  if (units === "in") return inches(cm, ascii);
  return String(Math.round(cm * 10) / 10);
}

/** Decimal inches (for Excel, which formats them as fractions). */
export const cmToIn = (cm: number) => Math.round((cm / CM_PER_IN) * 1000) / 1000;
export const inToCm = (inch: number) => Math.round(inch * CM_PER_IN * 100) / 100;

/** Read what she typed in inches: "32.5", "32 1/2", "32½", "1/4". Returns cm, or null if not a number. */
export function parseInches(raw: string): number | null {
  const s = raw.trim().replace(/["”]/g, "");
  if (!s) return null;
  const uni: Record<string, number> = { "⅛": 0.125, "¼": 0.25, "⅜": 0.375, "½": 0.5, "⅝": 0.625, "¾": 0.75, "⅞": 0.875 };
  let m = /^(-?\d+(?:\.\d+)?)?\s*([⅛¼⅜½⅝¾⅞])$/.exec(s);
  if (m) return inToCm((m[1] ? Number(m[1]) : 0) + uni[m[2]]);
  m = /^(-?\d+)?\s*(\d+)\/(\d+)$/.exec(s);
  if (m && Number(m[3]) > 0) return inToCm((m[1] ? Number(m[1]) : 0) + Number(m[2]) / Number(m[3]));
  const n = Number(s);
  return Number.isFinite(n) ? inToCm(n) : null;
}

export const unitLabel = (u: Units) => (u === "in" ? "inches" : "cm");
export const unitShort = (u: Units) => (u === "in" ? "in" : "cm");

/* ---------- factory document languages ---------- */

export const LANGUAGES = [
  { code: "en", name: "English", native: "English", region: "" },
  { code: "hi", name: "Hindi", native: "हिन्दी", region: "Delhi NCR, Jaipur, Noida, Uttar Pradesh" },
  { code: "ta", name: "Tamil", native: "தமிழ்", region: "Tiruppur, Chennai, Coimbatore" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", region: "Bengaluru, Mysuru" },
  { code: "te", name: "Telugu", native: "తెలుగు", region: "Hyderabad, Andhra Pradesh" },
  { code: "bn", name: "Bengali", native: "বাংলা", region: "Kolkata, Bangladesh" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", region: "Ahmedabad, Surat" },
  { code: "mr", name: "Marathi", native: "मराठी", region: "Mumbai, Ichalkaranji" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", region: "Ludhiana" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", region: "Kerala" },
  { code: "ur", name: "Urdu", native: "اردو", region: "" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文", region: "China" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", region: "Vietnam" },
  { code: "si", name: "Sinhala", native: "සිංහල", region: "Sri Lanka" },
  { code: "tr", name: "Turkish", native: "Türkçe", region: "Turkey" },
  { code: "pt", name: "Portuguese", native: "Português", region: "Portugal" },
  { code: "es", name: "Spanish", native: "Español", region: "" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export function languageOf(code: string | undefined) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export const isRtl = (code: string) => code === "ur";

/* ---------- vendor countries ---------- */

export const VENDOR_COUNTRIES = [
  "India",
  "Bangladesh",
  "Sri Lanka",
  "China",
  "Vietnam",
  "Pakistan",
  "Turkey",
  "Portugal",
  "Other",
] as const;
