"use client";

import { useRef } from "react";
import { Tag, Tags, Trash2, Upload, Wand2 } from "lucide-react";
import { emptyLabels, Product } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import { readAsDataUrl, useAction } from "@/lib/useAction";
import { Section, Status } from "./Section";

const POSITIONS = {
  product: ["Inside back neck", "Inside back waist", "Left side seam", "Centre back hem", "Inside right seam"],
  hangTag: ["Front loop", "Neck label", "Side seam", "Waistband", "Care label"],
};

export default function LabelsTags({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const { run, busy, error, setError } = useAction(onUpdate);
  const labels = { ...emptyLabels, ...(product.labels ?? {}) };
  const base = `/api/products/${product.id}/labels`;
  const tp = product.techPack!;

  return (
    <Section
      id="labels"
      title="Labels & Tags"
      subtitle="Product labels and hang tags for manufacturing documentation"
      badge={<span className="rounded-full border border-line px-2 text-[11px] text-muted">Care & branding</span>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(["product", "hangTag"] as const).map((slot) => (
          <Slot
            key={slot}
            title={slot === "product" ? "Product label" : "Hang tag"}
            subtitle={slot === "product" ? "Care / woven label" : "Price / brand tag"}
            icon={slot === "product" ? <Tag size={15} /> : <Tags size={15} />}
            productId={product.id}
            value={labels[slot]}
            positions={POSITIONS[slot]}
            busy={!!busy}
            onGenerate={(notes) => run(base, "POST", { slot, mode: "ai", notes }, "Designing label artwork… about 30–60 seconds")}
            onUpload={async (f) => {
              if (f.size > 8 * 1024 * 1024) return setError("That file is over 8 MB.");
              run(base, "POST", { slot, mode: "upload", dataUrl: await readAsDataUrl(f) }, "Uploading…");
            }}
            onPatch={(body) => run(base, "PATCH", { slot, ...body }, "Saving…")}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="field-label mb-1">Care instructions (from the tech pack)</div>
          <ul className="list-disc pl-5 text-sm">
            {tp.careInstructions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="field-label mb-1">Labels & packaging spec</div>
          <ul className="space-y-1 text-sm">
            {tp.labelsPackaging.map((l, i) => (
              <li key={i}>
                <span className="font-medium">{l.item}:</span> <span className="text-muted">{l.details}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Status busy={busy} error={error} />
    </Section>
  );
}

function Slot({
  title,
  subtitle,
  icon,
  productId,
  value,
  positions,
  busy,
  onGenerate,
  onUpload,
  onPatch,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  productId: string;
  value: { file: string | null; position: string; notes: string; source: string | null };
  positions: string[];
  busy: boolean;
  onGenerate: (notes: string) => void;
  onUpload: (f: File) => void;
  onPatch: (body: object) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const options = positions.includes(value.position) ? positions : [value.position, ...positions];

  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        {icon}
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[11px] text-muted">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        {value.file ? (
          <div className="relative overflow-hidden rounded-lg border border-line bg-white">
            <a href={fileUrl(productId, value.file)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(productId, value.file)} alt={title} className="aspect-[3/2] w-full object-contain" />
            </a>
            <button className="btn absolute right-2 top-2 h-7 px-2" aria-label="Remove" disabled={busy} onClick={() => onPatch({ remove: true })}>
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button className="flex aspect-[3/1] w-full flex-col items-center justify-center rounded-lg border border-line bg-white text-xs text-muted hover:border-accent" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={15} className="mb-1" /> Click to upload
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onUpload(f);
          }}
        />
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-warn-soft py-2.5 text-xs font-medium text-warn-ink hover:brightness-95 disabled:opacity-50"
          disabled={busy}
          onClick={() => onGenerate(notesRef.current?.value ?? value.notes)}
        >
          <Wand2 size={13} /> {value.file ? "Regenerate with AI" : "Generate with AI"}
        </button>
        <label className="block">
          <span className="field-label">Position</span>
          <select className="input mt-0.5" value={value.position} onChange={(e) => onPatch({ position: e.target.value })}>
            {options.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Notes (optional)</span>
          <input
            ref={notesRef}
            className="input mt-0.5"
            placeholder="e.g. 2 cm × 4 cm, cream ground, gold thread"
            defaultValue={value.notes}
            onBlur={(e) => e.target.value !== value.notes && onPatch({ notes: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
