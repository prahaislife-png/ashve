"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Link2,
  Mail,
  RotateCcw,
  Trash2,
  Wand2,
} from "lucide-react";
import { metaFor, OUTPUTS, OutputKey, Product, ProductStatus, outputStatus } from "@/lib/schema";
import { useAction } from "@/lib/useAction";
import { COST, Cost, Status } from "@/components/specs/Section";
import TitleBlock from "@/components/TitleBlock";

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [versionName, setVersionName] = useState("");
  const tp = product.techPack;
  const status = outputStatus(product);

  if (!tp) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center p-6 text-ink-2">
        Nothing to hand off yet. Start in the Design step.
      </div>
    );
  }

  const verifiedRows = tp.measurements.filter((m) => metaFor(product, m.code).verified).length;
  const shareUrl = product.share?.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/${product.share.token}`
    : null;
  const versions = [...(product.versions ?? [])].reverse();

  const checks: { label: string; ok: boolean; hint: string; fix?: () => void }[] = [
    ...OUTPUTS.map((o) => ({
      label: o.label,
      ok: status[o.key],
      hint: status[o.key] ? "Ready" : "Not made yet",
      fix: () => openSpecs(o.key),
    })),
    {
      label: "Measurements verified",
      ok: verifiedRows === tp.measurements.length && tp.measurements.length > 0,
      hint: `${verifiedRows} of ${tp.measurements.length} rows`,
      fix: () => openSpecs("flats"),
    },
    {
      label: "Open decisions",
      ok: tp.openQuestions.length === 0,
      hint: tp.openQuestions.length ? `${tp.openQuestions.length} still to decide` : "All decided",
      fix: () => openSpecs("basic"),
    },
    {
      label: "Costing targets",
      ok: tp.costing.targetFobUsd != null && tp.costing.moqPerColor != null,
      hint: tp.costing.targetFobUsd != null ? "Set" : "Target price and order size per colour",
      fix: () => openSpecs("basic"),
    },
    {
      label: "Style number",
      ok: !!tp.styleNumber && tp.styleNumber !== "TBC",
      hint: tp.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : "Ask the assistant to assign one",
    },
  ];
  const done = checks.filter((c) => c.ok).length;
  const ready = done === checks.length;

  return (
    <div className="min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <TitleBlock product={product} />

        <section className="mt-10" aria-labelledby="ready-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="ready-title" className="h-title text-[22px]">
                {ready ? "Ready for the factory" : "Before it goes to a factory"}
              </h2>
              <p className="num mt-1 text-[13.5px] text-ink-2">
                {done} of {checks.length} checks done
              </p>
            </div>
            <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
              Status
              <select
                className="input w-auto"
                value={product.status}
                onChange={(e) =>
                  run(`/api/products/${product.id}`, "PATCH", { status: e.target.value as ProductStatus }, "Saving")
                }
              >
                <option value="draft">Draft</option>
                <option value="sampling">Sampling</option>
                <option value="approved">Approved</option>
              </select>
            </label>
          </div>

          <ul className="mt-4 border-t border-line">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 border-b border-line py-3">
                {c.ok ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok-soft text-ok">
                    <Check size={12} />
                  </span>
                ) : (
                  <CircleAlert size={18} className="text-warn" aria-label="Needs attention" />
                )}
                <span className="flex-1 text-ink">{c.label}</span>
                <span className="text-[13px] text-muted">{c.hint}</span>
                {!c.ok && c.fix && (
                  <button className="btn h-7 min-h-0 px-2.5 text-[12.5px]" onClick={c.fix}>
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-muted">
            AI-made measurements and materials are a starting point. Check them against your fit sample before bulk.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="files-title">
          <h2 id="files-title" className="h-title text-[22px]">
            Files for the factory
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href={`/products/${product.id}/print`}
              target="_blank"
              className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-elev-lg"
            >
              <FileText size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block font-medium text-ink">Tech pack PDF</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">
                  Every section in one document. Print it or save as PDF.
                </span>
              </span>
            </Link>
            <a
              href={`/api/products/${product.id}/excel`}
              className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-elev-lg"
            >
              <FileSpreadsheet size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block font-medium text-ink">Excel workbook</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">
                  Size chart with grade steps, bill of materials, construction, colours, labels and care.
                </span>
              </span>
            </a>
            <a
              href={`/api/products/${product.id}/export`}
              className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-elev-lg sm:col-span-2"
            >
              <FileArchive size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block font-medium text-ink">Factory pack ZIP</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">
                  Everything in one download: Excel, SVG flats, images, prints, labels, size chart and bill of materials.
                </span>
              </span>
            </a>
          </div>

          {/* Factory link */}
          <div className="mt-6 rounded-xl bg-card p-4 shadow-elev-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Link2 size={20} className="mt-0.5 text-accent" />
                <div>
                  <div className="font-medium text-ink">Factory link</div>
                  <p className="mt-0.5 max-w-md text-[13px] text-ink-2">
                    A private read-only page with the full tech pack, Excel and ZIP. The factory needs no login.
                    It always shows the latest version. Turn it off any time.
                  </p>
                </div>
              </div>
              {shareUrl ? (
                <button
                  className="btn text-danger"
                  disabled={!!busy}
                  onClick={() =>
                    confirm("Turn off the factory link? Anyone with it will lose access.") &&
                    run(`/api/products/${product.id}/share`, "DELETE", undefined, "Turning the link off")
                  }
                >
                  Turn off
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={!!busy}
                  onClick={() => run(`/api/products/${product.id}/share`, "POST", undefined, "Creating the link")}
                >
                  Create link
                </button>
              )}
            </div>
            {shareUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className="input code flex-1 text-[12.5px]" readOnly value={shareUrl} aria-label="Factory link" onFocus={(e) => e.target.select()} />
                <button
                  className="btn"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 1500);
                  }}
                >
                  <Copy size={14} /> {linkCopied ? "Copied" : "Copy"}
                </button>
                <a className="btn" href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="versions-title">
          <h2 id="versions-title" className="h-title text-[22px]">
            Versions
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Save the tech pack as it is now, for example before sending it to a factory. Restoring never deletes anything.
          </p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(`/api/products/${product.id}`, "PATCH", { saveVersion: versionName }, "Saving the version"))
                setVersionName("");
            }}
          >
            <input
              className="input"
              placeholder="Name, e.g. Sent to Factory A for first sample"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              aria-label="Version name"
            />
            <button className="btn btn-primary" disabled={!!busy}>
              <Bookmark size={14} /> Save version
            </button>
          </form>
          {versions.length > 0 && (
            <ul className="mt-4 border-t border-line">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3">
                  <Bookmark size={15} className="text-accent" />
                  <span className="flex-1">
                    <span className="block text-ink">{v.name}</span>
                    <span className="block text-[12.5px] text-muted">{new Date(v.at).toLocaleString()}</span>
                  </span>
                  <button
                    className="btn h-7 min-h-0 px-2.5 text-[12.5px]"
                    disabled={!!busy}
                    onClick={() =>
                      confirm(`Go back to “${v.name}”? Today's tech pack stays in the history, so nothing is lost.`) &&
                      run(`/api/products/${product.id}`, "PATCH", { restoreVersion: v.id }, "Restoring the version")
                    }
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                  <button
                    className="btn btn-ghost h-7 min-h-0 px-2 text-[12.5px] text-danger"
                    disabled={!!busy}
                    aria-label={`Delete ${v.name}`}
                    onClick={() =>
                      confirm(`Delete the saved version “${v.name}”?`) &&
                      run(`/api/products/${product.id}`, "PATCH", { deleteVersion: v.id }, "Deleting")
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {product.revisions.length > 0 && (
            <details className="mt-4 text-[13px]">
              <summary className="cursor-pointer text-ink-2">
                Automatic history ({product.revisions.length} earlier saves)
              </summary>
              <ul className="mt-2 border-t border-line">
                {product.revisions
                  .map((r, i) => ({ r, i }))
                  .reverse()
                  .map(({ r, i }) => (
                    <li key={i} className="flex items-center gap-3 border-b border-line py-2">
                      <span className="num flex-1 text-ink-2">{new Date(r.at).toLocaleString()}</span>
                      <button
                        className="btn h-7 min-h-0 px-2.5 text-[12.5px]"
                        disabled={!!busy}
                        onClick={() =>
                          confirm("Restore this earlier tech pack? Today's stays in the history.") &&
                          run(`/api/products/${product.id}`, "PATCH", { restoreRevision: i }, "Restoring")
                        }
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>

        <section className="mt-10 pb-16" aria-labelledby="email-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="email-title" className="h-title flex items-center gap-2 text-[22px]">
                <Mail size={18} className="text-accent" /> Quote request
              </h2>
              <p className="mt-1 text-[13.5px] text-ink-2">
                An email asking a factory for sample and bulk prices. You send it from your own inbox.
              </p>
            </div>
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => run(`/api/products/${product.id}/rfq`, "POST", {}, "Writing the email")}
            >
              <Wand2 size={14} /> {product.rfq ? "Rewrite email" : "Write email"} <Cost usd={COST.email} />
            </button>
          </div>
          {product.rfq && (
            <div className="mt-4">
              <div className="card p-4">
                <div className="mb-3 border-b border-line pb-2 text-ink">
                  <span className="text-muted">Subject </span>
                  {product.rfq.subject}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink">
                  {product.rfq.body}
                </pre>
              </div>
              <button
                className="btn mt-3"
                onClick={async () => {
                  await navigator.clipboard.writeText(`Subject: ${product.rfq!.subject}\n\n${product.rfq!.body}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Copy size={14} /> {copied ? "Copied" : "Copy email"}
              </button>
            </div>
          )}
          <Status busy={busy} error={error} />
        </section>
      </div>
    </div>
  );
}
