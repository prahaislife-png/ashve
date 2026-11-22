"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Copy, Download, FileArchive, FileText, Mail, Wand2 } from "lucide-react";
import { OUTPUTS, OutputKey, Product, ProductStatus, outputStatus } from "@/lib/schema";
import { useAction } from "@/lib/useAction";
import { Status } from "@/components/specs/Section";

export default function HandoffStep({
  product,
  onUpdate,
  openSpecs,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  openSpecs: (k: OutputKey) => void;
}) {
  const { run, busy, error } = useAction(onUpdate);
  const [copied, setCopied] = useState(false);
  const tp = product.techPack;
  const status = outputStatus(product);

  if (!tp) {
    return (
      <div className="canvas-dots flex h-[calc(100vh-57px)] items-center justify-center p-6 text-sm text-muted">
        Nothing to hand off yet. Start in the Design step.
      </div>
    );
  }

  const checks: { label: string; ok: boolean; hint: string; fix?: () => void }[] = [
    ...OUTPUTS.map((o) => ({
      label: o.label,
      ok: status[o.key],
      hint: status[o.key] ? "Ready" : "Not generated yet",
      fix: () => openSpecs(o.key),
    })),
    {
      label: "Open questions answered",
      ok: tp.openQuestions.length === 0,
      hint: tp.openQuestions.length ? `${tp.openQuestions.length} still to decide` : "All decided",
      fix: () => openSpecs("basic"),
    },
    {
      label: "Costing targets set",
      ok: tp.costing.targetFobUsd != null && tp.costing.moqPerColor != null,
      hint: "Target factory price and order size per colour",
      fix: () => openSpecs("basic"),
    },
    {
      label: "Style number",
      ok: !!tp.styleNumber && tp.styleNumber !== "TBC",
      hint: tp.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : "Ask the assistant to assign one",
    },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <div className="canvas-dots min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="h-title text-2xl">Hand off</h1>
          <p className="mt-1 text-sm text-muted">Everything the factory needs, in one place.</p>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Readiness</div>
              <div className="text-xs text-muted">
                {done} of {checks.length} done
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              Status
              <select
                className="input w-auto"
                value={product.status}
                onChange={(e) => run(`/api/products/${product.id}`, "PATCH", { status: e.target.value as ProductStatus }, "Saving…")}
              >
                <option value="draft">Draft</option>
                <option value="sampling">Sampling</option>
                <option value="approved">Approved</option>
              </select>
            </label>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-accent-soft">
            <div className="h-full bg-accent transition-all" style={{ width: `${(done / checks.length) * 100}%` }} />
          </div>
          <ul className="mt-4 divide-y divide-line">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2.5 text-sm">
                {c.ok ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok-soft text-ok">
                    <Check size={12} />
                  </span>
                ) : (
                  <CircleAlert size={18} className="text-warn-ink" />
                )}
                <span className="flex-1">{c.label}</span>
                <span className="text-xs text-muted">{c.hint}</span>
                {!c.ok && c.fix && (
                  <button className="btn h-7 px-2 text-xs" onClick={c.fix}>
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link href={`/products/${product.id}/print`} target="_blank" className="card flex flex-col gap-2 p-4 hover:border-accent">
            <FileText size={18} />
            <span className="text-sm font-medium">Tech pack PDF</span>
            <span className="text-xs text-muted">Every section, ready to print or “Save as PDF”</span>
          </Link>
          <a href={`/api/products/${product.id}/export`} className="card flex flex-col gap-2 p-4 hover:border-accent">
            <FileArchive size={18} />
            <span className="text-sm font-medium">Factory pack (ZIP)</span>
            <span className="text-xs text-muted">SVG flats, images, prints, labels, size chart and bill of materials</span>
          </a>
          <Link href={`/products/${product.id}/print`} target="_blank" className="card flex flex-col gap-2 p-4 hover:border-accent">
            <Download size={18} />
            <span className="text-sm font-medium">Download summary</span>
            <span className="text-xs text-muted">Same PDF, to share with a freelancer or sample room</span>
          </Link>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail size={16} />
              <div>
                <div className="text-sm font-medium">Message to the factory</div>
                <div className="text-xs text-muted">A ready-to-send quote request. You send it from your own email.</div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => run(`/api/products/${product.id}/rfq`, "POST", {}, "Writing the email…")}
            >
              <Wand2 size={14} /> {product.rfq ? "Rewrite" : "Write it"}
            </button>
          </div>
          {product.rfq && (
            <div className="mt-4">
              <div className="rounded-lg bg-panel p-3 text-sm">
                <div className="mb-2 font-medium">Subject: {product.rfq.subject}</div>
                <pre className="whitespace-pre-wrap font-sans leading-relaxed">{product.rfq.body}</pre>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`Subject: ${product.rfq!.subject}\n\n${product.rfq!.body}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <Copy size={14} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <Status busy={busy} error={error} />
        </div>
      </div>
    </div>
  );
}
