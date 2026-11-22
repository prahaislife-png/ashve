import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { changeProduct, Ctx, errorResponse, UserError } from "@/lib/route";
import { applyTechPack, getBrand } from "@/lib/store";
import { runTechPackTurn } from "@/lib/ai";
import { createJob } from "@/lib/jobs";
import { DecisionLogEntry, DecisionMode, diffTechPack, Job, productViews, TechPack } from "@/lib/schema";
import { viewsWorkflow } from "@/workflows/views";
import { flatsWorkflow } from "@/workflows/flats";

export const maxDuration = 300;

type Answer = { question: string; answer: string; mode: DecisionMode };

/**
 * Apply her answers to open decisions: Claude updates every affected part of the
 * tech pack, then (optionally) the product photos and flats are redone in the background.
 * Body: { answers: [{ question, answer, mode: "answer" | "factory" }], refresh?: boolean }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as { answers?: Answer[]; refresh?: boolean };
    const answers = (Array.isArray(body.answers) ? body.answers : [])
      .map((a) => ({
        question: String(a?.question ?? "").slice(0, 600),
        answer: String(a?.answer ?? "").trim().slice(0, 1000),
        mode: (a?.mode === "factory" ? "factory" : "answer") as DecisionMode,
      }))
      .filter((a) => a.question && (a.mode === "factory" || a.answer))
      .slice(0, 30);

    // Filled in by the change below (a callback, so kept in an object).
    const out: { before?: TechPack; after?: TechPack; reply: string } = { reply: "" };

    const saved = await changeProduct(id, async (product) => {
      const tp = product.techPack;
      if (!tp) throw new UserError("Create the tech pack first.");
      const open = answers.filter((a) => tp.openQuestions.includes(a.question));
      if (!open.length) throw new UserError("These decisions are already settled. Reload the page to see the latest.");

      const lines = open.map((a, i) =>
        a.mode === "factory"
          ? `${i + 1}. "${a.question}"\n   → Factory to confirm${a.answer ? ` (my note: ${a.answer})` : ""}.`
          : `${i + 1}. "${a.question}"\n   → ${a.answer}`,
      );
      const message = [
        "I've answered these open decisions:",
        ...lines,
        "",
        "Apply every answer throughout the tech pack: update all affected sections (measurements and tolerances for every size, fabrics, trims, construction, colours, costing, labels, product information, description) so everything agrees.",
        "Remove each answered item from openQuestions. For items marked 'Factory to confirm', write the point into the most relevant section's notes or description starting with 'Factory to confirm:' and remove it from openQuestions too.",
        "Keep every other open question exactly as it is, word for word. Add a new open question only if an answer creates a genuinely new decision.",
      ].join("\n");

      const turn = await runTechPackTurn({
        productId: id,
        brand: product.useBrand === false ? null : await getBrand(),
        history: product.messages,
        current: tp,
        productName: product.name,
        message,
        images: [],
      });

      out.before = tp;
      out.after = turn.techPack;
      out.reply = turn.reply;
      const now = new Date().toISOString();
      const cards = product.decisionCards ?? {};
      const userText = open
        .map((a) => `• ${cards[a.question]?.title ?? a.question} → ${a.mode === "factory" ? "Factory to confirm" : a.answer}`)
        .join("\n");
      product.messages = [
        ...product.messages,
        { role: "user", content: `Answered ${open.length} ${open.length === 1 ? "decision" : "decisions"}:\n${userText}`, at: now },
        { role: "assistant", content: turn.reply, at: now },
      ];
      applyTechPack(product, turn.techPack);
      const log: DecisionLogEntry[] = open.map((a) => ({
        id: randomUUID(),
        at: now,
        question: a.question,
        title: cards[a.question]?.title ?? a.question,
        answer: a.mode === "factory" ? a.answer || "Factory to confirm" : a.answer,
        mode: a.mode,
      }));
      product.decisionLog = [...(product.decisionLog ?? []), ...log].slice(-200);
      const nextCards: typeof cards = {};
      for (const q of turn.techPack.openQuestions) if (cards[q]) nextCards[q] = cards[q];
      product.decisionCards = nextCards;
    });
    if (!saved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const diff = diffTechPack(out.before!, out.after!);
    const jobs: Job[] = [];
    if (body.refresh) {
      const front = productViews(saved)["product-front"];
      if (diff.views && front) {
        const names = saved.techPack!.colorways.map((c) => c.name);
        const colorway = names.includes(front.colorway) ? front.colorway : (names[0] ?? "");
        const job = await createJob(id, "views", ["front", "sideback"]);
        await start(viewsWorkflow, [id, job.id, { only: null, colorway, note: "" }]);
        jobs.push(job);
      }
      if (diff.flats && saved.flats?.length) {
        const job = await createJob(id, "flats");
        await start(flatsWorkflow, [id, job.id, "Update the flats to match the decisions just made in the tech pack."]);
        jobs.push(job);
      }
    }
    return NextResponse.json({ product: saved, reply: out.reply, changed: diff.sections, jobs });
  } catch (error) {
    return errorResponse(error);
  }
}
