import { NextResponse } from "next/server";
import { readMonth } from "@/lib/usage";

export const dynamic = "force-dynamic";

/** This month's usage, summed for the on-screen monitor. GET ?month=YYYY-MM */
export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const events = await readMonth(month);
  const today = new Date().toISOString().slice(0, 10);

  const sum = (list: typeof events) => list.reduce((s, e) => s + e.costUsd, 0);
  const group = (key: (e: (typeof events)[number]) => string) => {
    const m = new Map<string, { cost: number; count: number }>();
    for (const e of events) {
      const k = key(e);
      const g = m.get(k) ?? { cost: 0, count: 0 };
      g.cost += e.costUsd;
      g.count += 1;
      m.set(k, g);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.cost - a.cost);
  };

  return NextResponse.json({
    month,
    totalUsd: sum(events),
    todayUsd: sum(events.filter((e) => e.at.startsWith(today))),
    count: events.length,
    byKind: group((e) => e.kind),
    byProvider: group((e) => (e.provider === "claude" ? "Claude (text & drawings)" : "OpenAI (images)")),
    byProduct: group((e) => e.productName ?? "Other"),
    recent: events
      .slice(-12)
      .reverse()
      .map(({ at, kind, productName, costUsd, provider }) => ({ at, kind, productName, costUsd, provider })),
  });
}
