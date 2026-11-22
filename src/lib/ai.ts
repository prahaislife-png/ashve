import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import {
  AssistantTurn,
  AssistantTurnWireSchema,
  DecisionCardsSchema,
  fromWire,
  Brand,
  ChatMessage,
  DetailSuggestSchema,
  FlatFrontBack,
  FlatFrontBackSchema,
  MeasurementGuideSchema,
  RfqSchema,
  TechnicalSketch,
  TechnicalSketchSchema,
  TechPack,
} from "./schema";
import { readImage } from "./files";
import { claudeCost, recordUsage } from "./usage";

const MODEL = "claude-opus-5-5";

// Reads ANTHROPIC_API_KEY from .env.local
const client = new Anthropic();

const INSTRUCTIONS = `You are a senior technical designer for a women's loungewear brand. You turn the designer's plain-language ideas into a factory-ready tech pack, and you update it every time she asks for a change.

How to work:
- Always return the COMPLETE tech pack (every section), not just the parts that changed.
- Use centimetres for all measurements. Give a value for every size in \`sizes\`, in the same order. Grade sensibly from the base size (typical loungewear grade: 4–5 cm chest/waist/hip per size, 1–1.5 cm length per size, 0.5–1 cm smaller points).
- Use standard points of measure for the garment type (e.g. tops: body length HPS, chest 2.5 cm below armhole, sweep, sleeve length, armhole, neck width, neck drop; bottoms: waist relaxed and extended, hip, front/back rise, inseam, thigh, knee, leg opening). Give clear how-to-measure notes and realistic tolerances (usually ±0.5–1.5 cm).
- Construction must be specific enough for a sample room: stitch type with ISO number where relevant (301 lockstitch, 401 chainstitch, 406 coverstitch, 504/514 overlock, 605/607 flatlock), stitches per inch, seam allowances, elastic width and finish, binding widths.
- Prefer fabrics, colours, sizes, fit and labels from the Brand DNA unless she asks for something different.
- Fill the product information fields too: subcategory, productType, intendedUse, targetMarket, an estimated finished weight in grams for size M, and the pattern/texture.
- \`colors\` holds every colour: role "main" for each colourway the product is sold in, role "accent" for hardware, threads, trims and labels.
- Use 0 for any number you do not know (prices, MOQ, GSM, weight). The current tech pack you are shown may use null for these; that means unknown.
- The fabrics list is the bill of materials for fabrics; the trims list covers every other component (elastic, cords, thread, labels, hardware, interfacing).
- Never invent supplier names, certifications or prices. If something is unknown, make a sensible default where it is low-risk and add a short item to \`openQuestions\` for anything she must decide.
- \`reply\` is a short, warm message in plain English: say what you created or changed in 1–3 sentences, then ask at most 3 of the most important open questions. No markdown headings.`;

function brandBlock(brand: Brand | null) {
  if (!brand) return "BRAND DNA: switched off for this product. Design only from the designer's own words and photos.";
  return `BRAND DNA (the designer's saved brand settings):\n${JSON.stringify(brand, null, 2)}`;
}

export class AiError extends Error {
  /** Shown to the user as-is; also tells background jobs not to retry. */
  readonly userFacing = true;
}

async function imageBlocks(
  productId: string,
  names: string[] | undefined,
): Promise<Anthropic.Beta.BetaImageBlockParam[]> {
  const blocks: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const name of names ?? []) {
    const img = await readImage(productId, name);
    if (!img || img.mime === "image/svg+xml") continue;
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: img.mime, data: img.buffer.toString("base64") },
    });
  }
  return blocks;
}

export async function runTechPackTurn(opts: {
  productId: string;
  brand: Brand | null;
  history: ChatMessage[];
  current: TechPack | null;
  productName: string;
  message: string;
  images: string[];
}): Promise<AssistantTurn> {
  const { productId, brand, history, current, productName, message, images } = opts;

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    if (m.role === "user" && m.images?.length) {
      messages.push({
        role: "user",
        content: [...(await imageBlocks(productId, m.images)), { type: "text", text: m.content }],
      });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const state = current
    ? `CURRENT TECH PACK (JSON):\n${JSON.stringify(current)}`
    : `There is no tech pack yet. The product is called "${productName}". Create the first version.`;

  const photoNote = images.length
    ? `\n\n(The designer attached ${images.length} reference photo${images.length > 1 ? "s" : ""} above. Use them for silhouette, proportions and details, but follow her words where they differ.)`
    : "";

  messages.push({
    role: "user",
    content: [
      ...(await imageBlocks(productId, images)),
      { type: "text", text: `${state}\n\nDESIGNER'S MESSAGE:\n${message || "(see photos)"}${photoNote}` },
    ],
  });

  const turn = await structuredCall(AssistantTurnWireSchema, {
    system: [
      { type: "text", text: INSTRUCTIONS },
      { type: "text", text: brandBlock(brand), cache_control: { type: "ephemeral" } },
    ],
    messages,
    what: "tech pack",
  });
  return { reply: turn.reply, techPack: fromWire(turn.techPack) };
}

/** Names shown in the usage monitor. */
const KIND_LABEL: Record<string, string> = {
  "tech pack": "Tech pack chat",
  "set of drawings": "Flat sketches",
  "measurement guide": "Flat sketches",
  "technical sketch": "Technical sketch",
  "detail list": "Detail finder",
  email: "Factory email",
  "decision options": "Decision options",
};

/** One streamed Claude call that must return JSON matching `schema`. */
async function structuredCall<S extends z.ZodType>(
  schema: S,
  opts: {
    system: Anthropic.Beta.BetaTextBlockParam[];
    messages: Anthropic.Beta.BetaMessageParam[];
    what: string;
    effort?: "low" | "medium" | "high";
  },
): Promise<z.infer<S>> {
  let final: Anthropic.Beta.BetaMessage;
  const started = Date.now();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: opts.effort ?? "medium",
        format: betaZodOutputFormat(schema),
      },
      system: opts.system,
      messages: opts.messages,
    });
    final = await stream.finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiError("The Claude API key is missing or invalid. Add ANTHROPIC_API_KEY to .env.local and restart the app.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError("Claude is rate-limited right now. Wait a minute and try again.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiError(`Claude API error ${error.status ?? ""}: ${error.message}`);
    }
    if (error instanceof Error && /api key|apiKey|authentication/i.test(error.message)) {
      throw new AiError("No Claude API key found. Add ANTHROPIC_API_KEY to .env.local and restart the app.");
    }
    throw error;
  }

  // Record the cost before anything else: it was spent even if the answer turns out unusable.
  const { cost, tokens } = claudeCost(final.model, final.usage);
  await recordUsage({ provider: "claude", model: final.model, kind: KIND_LABEL[opts.what] ?? opts.what, costUsd: cost, tokens });
  console.log(
    `[claude] ${opts.what}: ${Math.round((Date.now() - started) / 1000)}s, ` +
      `in ${final.usage.input_tokens} (+${final.usage.cache_read_input_tokens ?? 0} cached), out ${final.usage.output_tokens}, $${cost.toFixed(4)}`,
  );

  if (final.stop_reason === "refusal") {
    throw new AiError("Claude declined this request. Try rephrasing it.");
  }
  if (final.stop_reason === "max_tokens") {
    throw new AiError("The response was cut off. Try a smaller change.");
  }

  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError(`Claude returned something that wasn't a valid ${opts.what}. Please try again.`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiError(`Claude's ${opts.what} didn't match the expected format. Please try again.`);
  }
  return result.data;
}

/* ---------- Technical flat drawings ---------- */

const FLAT_INSTRUCTIONS = `You are a senior technical designer who draws technical flats (CAD flat sketches) for women's loungewear tech packs. You write the drawings directly as SVG code.

Return two complete, standalone SVG documents:
1. front: the FRONT view of the garment(s), laid flat and perfectly symmetrical.
2. back: the BACK view, same scale and style.
If the product is a set (e.g. top + pants), draw each piece side by side or stacked in the same SVG, at the same scale.

Drawing rules (industry-standard flat style):
- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H"> with W and H between 600 and 1400. No width/height attributes. White background rect first.
- Black outlines only (#111), fill white. Outline stroke-width 2.5, inner seams 1.5, round line joins and caps. No shading, gradients, textures, photos, colour fills, filters or shadows.
- Draw to scale using the base-size measurements from the tech pack (pick one scale factor, e.g. 1 cm = 6 units, and keep proportions true: body length vs chest width, sleeve length, rise, inseam, leg opening).
- The outline follows the real side seams: straight or gently tapered lines for straight and wide-leg pants, a smooth curve only where the garment really curves (hip to waist). Pockets, splits and seams are drawn as lines INSIDE the outline and must never bend the outline outwards.
- Show every construction detail in the spec: seam lines, dropped/set-in shoulders, neckline shape and band width, rib bands (fine parallel lines across the band, spacing about 4 units), cuffs, hems, waistband with elastic gathering (short wavy lines), drawcord and eyelets, pocket openings, splits, plackets, labels where visible.
- Topstitching and coverstitch: dashed lines (stroke-dasharray "5 4", stroke-width 1.2) placed parallel to the edge at the right width (twin needle = two dashed lines).
- Back view: back neckline (usually higher), back neck tape, back yoke/seams, back label, back rise and waistband.
- Use only these elements: svg, g, rect, path, line, polyline, polygon, circle, ellipse, text, defs, marker. Do NOT use <use>, <image>, <foreignObject>, <style>, scripts, CSS classes, external fonts or links.
- No text on front and back except a small view label at the bottom ("FRONT" / "BACK"), font-family Arial, font-size 16, fill #111.

Keep each SVG clean and compact: use paths, avoid thousands of tiny segments. \`notes\` is one or two plain sentences for the designer about anything you assumed.`;

const GUIDE_INSTRUCTIONS = `You are a senior technical designer. You are given the FRONT technical flat (SVG) and the tech pack. Produce the MEASUREMENT GUIDE: the same front drawing with every point of measure drawn on it, as on the points-of-measure page of a factory tech pack.

Rules:
- Keep the garment drawing (same paths and proportions) but recolour its outlines light grey (#9a9a9a, stroke-width 1.5). Keep the white background rect first. You may enlarge the viewBox for labels.
- Add a dimension line for every point of measure in the tech pack that is measurable on the front, in blue (#1f5fbf, stroke-width 1.5) with small arrowheads at both ends (define one <marker> in <defs>, refer to it with marker-start/marker-end="url(#arrow)").
- Put the exact POM code from the tech pack (e.g. "T-A", "P-C") in a small white rounded label next to each line (font-family Arial, font-size 14, bold, fill #1f5fbf).
- Place lines where the how-to-measure note says (e.g. chest 2.5 cm below armhole, hip at the stated depth). Points that can only be measured on the back (back rise, back neck drop) go on a small grey back outline in a corner, or are left out.
- Only these elements: svg, g, rect, path, line, polyline, polygon, circle, ellipse, text, defs, marker. No <use>, <image>, <style>, scripts or links.`;

/** Measurement guide from an existing front flat (second half of the flats job). */
export async function drawMeasurementGuide(opts: { techPack: TechPack; frontSvg: string }) {
  return structuredCall(MeasurementGuideSchema, {
    system: [{ type: "text", text: GUIDE_INSTRUCTIONS }],
    messages: [
      {
        role: "user",
        content: `TECH PACK (JSON):\n${JSON.stringify({ sizes: opts.techPack.sizes, baseSize: opts.techPack.baseSize, measurements: opts.techPack.measurements })}\n\nFRONT FLAT SVG:\n${opts.frontSvg}`,
      },
    ],
    what: "measurement guide",
    effort: "low",
  });
}

/** Front and back technical flats (first half of the flats job). */
export async function drawFlats(opts: {
  productId: string;
  techPack: TechPack;
  instruction: string;
  previous: { front: string; back: string } | null;
  referenceImages: string[];
}): Promise<FlatFrontBack> {
  const { productId, techPack, instruction, previous, referenceImages } = opts;

  const parts: string[] = [
    `TECH PACK (JSON):\n${JSON.stringify(techPack)}`,
    `Base size for drawing proportions: ${techPack.baseSize}.`,
  ];
  if (previous) {
    parts.push(
      `CURRENT FRONT SVG (revise this rather than starting over):\n${previous.front}`,
      `CURRENT BACK SVG:\n${previous.back}`,
    );
  }
  if (referenceImages.length) {
    parts.push(
      "The attached images are the designer's reference photos and/or approved product mockups. Use them for silhouette, proportions and details; the tech pack wins where they differ.",
    );
  }
  parts.push(
    instruction
      ? `DESIGNER'S REQUEST:\n${instruction}`
      : previous
        ? "Redraw the flats so they match the current tech pack exactly."
        : "Draw the technical flats for this tech pack.",
  );

  return structuredCall(FlatFrontBackSchema, {
    system: [{ type: "text", text: FLAT_INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...(await imageBlocks(productId, referenceImages)),
          { type: "text", text: parts.join("\n\n") },
        ],
      },
    ],
    what: "set of drawings",
    effort: "medium",
  });
}

/* ---------- Technical sketch (construction callouts) ---------- */

const TECH_SKETCH_INSTRUCTIONS = `You are a senior technical designer. You are given a clean front technical flat (SVG) and the tech pack. Produce a TECHNICAL SKETCH: the same drawing with numbered construction callouts, as used on the construction page of a factory tech pack.

Rules:
- Keep the original garment drawing exactly (same paths, black #111 outlines). You may enlarge the viewBox to make room for callouts at the sides.
- Add 8–16 numbered callouts covering every construction area and trim in the tech pack (necklines, bands, seams, hems, waistband, elastic, drawcord, eyelets, pockets, straps/ties, labels, stitching).
- Each callout: a thin leader line (#c2410c, stroke-width 1.2) from a small dot (r=3) on the exact spot to a numbered circle (r=12, white fill, #c2410c stroke) placed outside the garment, with the number inside (font-family Arial, font-size 12, bold, fill #c2410c). Leader lines must not cross each other.
- No other text inside the SVG except "TECHNICAL SKETCH – FRONT" at the bottom (Arial 14, #111).
- Only these elements: svg, g, rect, path, line, polyline, polygon, circle, ellipse, text, defs, marker. No <use>, <image>, <style>, scripts or links.
- \`callouts\` lists the same numbers in order with a short title and the exact construction spec from the tech pack (stitch type, ISO number, SPI, widths).`;

export async function drawTechnicalSketch(opts: {
  techPack: TechPack;
  frontSvg: string;
}): Promise<TechnicalSketch> {
  return structuredCall(TechnicalSketchSchema, {
    system: [{ type: "text", text: TECH_SKETCH_INSTRUCTIONS }],
    messages: [
      {
        role: "user",
        content: `TECH PACK (JSON):\n${JSON.stringify(opts.techPack)}\n\nFRONT FLAT SVG:\n${opts.frontSvg}`,
      },
    ],
    what: "technical sketch",
    effort: "medium",
  });
}

/* ---------- Detail pins ---------- */

export async function suggestDetails(opts: {
  productId: string;
  techPack: TechPack;
  image: string;
}) {
  return structuredCall(DetailSuggestSchema, {
    system: [
      {
        type: "text",
        text: "You are a technical designer marking up a product photo for a factory. Find the key construction and trim details that are visible in the image and that matter for sampling (ties, straps, bands, gathers, elastic, pockets, hems, closures, hardware, labels). For each, give the exact position on the image as percentages and a short spec note taken from the tech pack. Be precise with positions: x is % from the left edge, y is % from the top edge of the whole image.",
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...(await imageBlocks(opts.productId, [opts.image])),
          { type: "text", text: `TECH PACK (JSON):\n${JSON.stringify(opts.techPack)}` },
        ],
      },
    ],
    what: "detail list",
    effort: "low",
  });
}

/* ---------- Factory request for quote ---------- */

export async function writeRfq(opts: { techPack: TechPack; brand: Brand }) {
  return structuredCall(RfqSchema, {
    system: [
      {
        type: "text",
        text: "Write a short, professional email from a small women's loungewear brand to a garment factory, asking for a sample and a bulk quote. Plain text, no markdown. Include: the style name and number, a 2-line description, main fabric and weight, sizes, colourways, target quantity per colour and target price if known, and say the full tech pack PDF, flats and measurement chart are attached. Ask for: sample cost and lead time, bulk price per unit at the stated quantity, MOQ per colour, bulk lead time, fabric options if the specified one is not available. Leave [Factory name] and [Your name] as placeholders. Never invent numbers that are not in the tech pack or brand settings.",
      },
    ],
    messages: [
      {
        role: "user",
        content: `BRAND:\n${JSON.stringify({ name: opts.brand.name, targetFobUsd: opts.brand.targetFobUsd, moqPerColor: opts.brand.moqPerColor })}\n\nTECH PACK:\n${JSON.stringify(opts.techPack)}`,
      },
    ],
    what: "email",
    effort: "low",
  });
}

/* ---------- Open decisions: one-click answer options ---------- */

const DECISION_INSTRUCTIONS = `You help a women's loungewear designer settle the open decisions in her tech pack quickly, without leaving the page.

For every open decision you are given, write one card:
- title: the decision as a short, plain question.
- context: one sentence that quotes what the tech pack says now (numbers with units) and why it matters for the sample.
- options: 2 to 4 concrete answers she can pick with one click. Each is specific and ready to apply: numbers with units, named finishes, stitch types, quantities. Put the answer you recommend for this product first. Base options on the tech pack, the product type and good loungewear practice.
- Do NOT offer "ask the factory", "decide later" or "other" as options; the app adds those itself.
- factoryCanAnswer: true for things a factory or supplier normally settles (quotes, MOQ, lab dips, fabric availability, test results).
- Never invent supplier names, certifications or prices. For price questions, offer target ranges as options only if the tech pack or brand gives a basis; otherwise offer quantity or approach choices.
Return exactly one card per decision, with its index.`;

export async function prepareDecisions(opts: { techPack: TechPack; questions: string[] }) {
  return structuredCall(DecisionCardsSchema, {
    system: [{ type: "text", text: DECISION_INSTRUCTIONS }],
    messages: [
      {
        role: "user",
        content: `TECH PACK (JSON):
${JSON.stringify(opts.techPack)}

OPEN DECISIONS:
${opts.questions.map((q, i) => `${i}. ${q}`).join("\n")}`,
      },
    ],
    what: "decision options",
    effort: "low",
  });
}
