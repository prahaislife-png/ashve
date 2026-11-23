import { NextResponse } from "next/server";
import { changeProduct, Ctx as BaseCtx, errorResponse, UserError } from "@/lib/route";
import { applyTechPack } from "@/lib/store";
import { aiContext } from "@/lib/collections";
import { runTechPackTurn } from "@/lib/ai";
import { diffTechPack, SAMPLE_STAGES, TechPack } from "@/lib/schema";
import { sampleRows } from "@/lib/samples";

export const maxDuration = 300;

type Ctx = BaseCtx<{ id: string; roundId: string }>;

/**
 * Turn a sample round's fit comments and measurements into the next version of
 * the tech pack. Claude separates real spec changes from factory sewing errors.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { id, roundId } = await params;
  try {
    const out: { before?: TechPack; after?: TechPack; reply: string } = { reply: "" };
    const saved = await changeProduct(id, async (product) => {
      const tp = product.techPack;
      if (!tp) throw new UserError("Create the tech pack first.");
      const round = product.samples?.find((r) => r.id === roundId);
      if (!round) throw new UserError("Sample round not found", 404);
      const rows = sampleRows(round).filter((r) => r.got != null);
      if (!round.comments.some((c) => c.text.trim()) && !rows.some((r) => r.out) && !round.overall.trim()) {
        throw new UserError("Add fit comments or measurements first.");
      }

      const fmt = (n: number | null) => (n == null ? "?" : String(n));
      const message = [
        `SAMPLE ROUND ${round.n}: ${SAMPLE_STAGES[round.stage]}${round.vendor ? ` from ${round.vendor}` : ""}, size ${round.size}.`,
        round.verdict && `Verdict: ${round.verdict}.`,
        rows.length &&
          `Measured on the sample (cm), compared with the spec the vendor worked from:\n${rows
            .map((r) => `- ${r.code} ${r.name}: spec ${fmt(r.spec)}, measured ${fmt(r.got)}, difference ${r.diff! > 0 ? "+" : ""}${fmt(r.diff)} (tolerance ±${r.tol})${r.out ? " OUT OF TOLERANCE" : ""}`)
            .join("\n")}`,
        round.comments.length &&
          `My fit comments:\n${round.comments
            .filter((c) => c.text.trim())
            .map((c, i) => `${i + 1}. [${c.severity === "major" ? "Major" : "Minor"}] ${c.area}: ${c.text.trim()}`)
            .join("\n")}`,
        round.overall.trim() && `Overall: ${round.overall.trim()}`,
        round.photos.length ? "The attached photos are of the physical sample." : "",
        "",
        "Update the tech pack for the next sample:",
        "- Where a comment asks for a design or fit change (e.g. 'bust too tight', 'strap 1 cm long'), change the spec for every size and keep the grading consistent; update how-to-measure notes if needed.",
        "- Where the sample is out of tolerance but the spec itself is right (the factory sewed it wrong) keep the spec, and add a short 'Factory to correct:' note to the relevant construction step.",
        "- Apply construction, fabric, trim, colour, print and label comments to their sections.",
        "- Do not change anything the comments don't touch.",
        "In your reply, list the spec changes and the factory corrections separately, in plain short sentences.",
      ]
        .filter((x): x is string => typeof x === "string")
        .join("\n");

      const turn = await runTechPackTurn({
        productId: id,
        ...(await aiContext(product)),
        history: product.messages,
        current: tp,
        productName: product.name,
        message,
        images: round.photos.slice(0, 4).map((p) => p.file),
      });
      out.before = tp;
      out.after = turn.techPack;
      out.reply = turn.reply;
      const now = new Date().toISOString();
      product.messages = [
        ...product.messages,
        { role: "user", content: `Fit comments from sample ${round.n} (${SAMPLE_STAGES[round.stage]}) applied.`, at: now },
        { role: "assistant", content: turn.reply, at: now },
      ];
      applyTechPack(product, turn.techPack);
      round.status = "reviewed";
      round.verdict ??= "revise";
      round.revision = { at: now, summary: turn.reply, changed: diffTechPack(tp, turn.techPack).sections };
    });
    if (!saved) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(saved);
  } catch (error) {
    return errorResponse(error);
  }
}
