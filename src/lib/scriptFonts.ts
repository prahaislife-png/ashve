import {
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_SC,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";

/*
 * Fonts for factory documents in Indian and other scripts. Not preloaded: the
 * browser only downloads a script's font when a page actually shows that script.
 */

const deva = Noto_Sans_Devanagari({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-deva" });
const tamil = Noto_Sans_Tamil({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-tamil" });
const kannada = Noto_Sans_Kannada({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-kannada" });
const telugu = Noto_Sans_Telugu({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-telugu" });
const bengali = Noto_Sans_Bengali({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-bengali" });
const gujarati = Noto_Sans_Gujarati({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-gujarati" });
const gurmukhi = Noto_Sans_Gurmukhi({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-gurmukhi" });
const malayalam = Noto_Sans_Malayalam({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-malayalam" });
const sinhala = Noto_Sans_Sinhala({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-sinhala" });
const arabic = Noto_Sans_Arabic({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-arabic" });
const sc = Noto_Sans_SC({ weight: ["400", "600"], preload: false, display: "swap", variable: "--font-sc" });

const all = [deva, tamil, kannada, telugu, bengali, gujarati, gurmukhi, malayalam, sinhala, arabic, sc];

/** Class names that define the font variables. */
export const scriptFontVars = all.map((f) => f.variable).join(" ");

/** Plex first (Latin), then each script's Noto font as a fallback. */
export const scriptFontStack = [
  "var(--font-plex-sans)",
  "var(--font-deva)",
  "var(--font-tamil)",
  "var(--font-kannada)",
  "var(--font-telugu)",
  "var(--font-bengali)",
  "var(--font-gujarati)",
  "var(--font-gurmukhi)",
  "var(--font-malayalam)",
  "var(--font-sinhala)",
  "var(--font-arabic)",
  "var(--font-sc)",
  "system-ui",
  "sans-serif",
].join(", ");
