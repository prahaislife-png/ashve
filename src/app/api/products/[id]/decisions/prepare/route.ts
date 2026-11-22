import { Ctx, mutateProduct } from "@/lib/route";
import { prepareDecisions } from "@/lib/ai";
import { DecisionCard } from "@/lib/schema";

export const maxDuration = 120;

const AREAS = ["Size chart", "Materials", "Construction", "Trims", "Colours", "Costing", "Labels", "Product information"];

/** Write one-click answer options for every open decision that doesn't have them yet. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return mutateProduct(id, async (product) => {
    const tp = product.techPack;
    if (!tp) return;
    const cards = product.decisionCards ?? {};
    const missing = tp.openQuestions.filter((q) => !cards[q]);
    if (!missing.length) return;

    const { cards: made } = await prepareDecisions({ techPack: tp, questions: missing });
    const next: Record<string, DecisionCard> = {};
    // Keep only cards for decisions that are still open.
    for (const q of tp.openQuestions) if (cards[q]) next[q] = cards[q];
    for (const c of made) {
      const q = missing[c.index];
      if (!q || next[q]) continue;
      next[q] = {
        title: c.title.trim() || q,
        context: c.context.trim(),
        area: AREAS.find((a) => a.toLowerCase() === c.area.trim().toLowerCase()) ?? "Product information",
        options: c.options.filter((o) => o.label.trim()).slice(0, 4),
        factoryCanAnswer: c.factoryCanAnswer,
      };
    }
    product.decisionCards = next;
  });
}
