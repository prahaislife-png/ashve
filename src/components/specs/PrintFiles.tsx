"use client";

import { useRef, useState } from "react";
import { Palette, Repeat, Shapes, Trash2, Upload, Wand2 } from "lucide-react";
import { Product } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import { readAsDataUrl, useAction } from "@/lib/useAction";
import { Section, Status } from "./Section";

export default function PrintFiles({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const tp = product.techPack!;
  const { run, busy, error, setError } = useAction(onUpdate);
  const [kind, setKind] = useState<"repeat" | "placement">("repeat");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState("");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const prints = product.prints ?? [];
  const base = `/api/products/${product.id}/prints`;
  const meta = { kind, name, placement, widthCm: w || null, heightCm: h || null };
  const solid = /^(solid|plain|none)/i.test(tp.pattern || "solid");

  return (
    <Section
      id="print"
      title="Print Specs"
      subtitle="Manufacturing-ready print patterns and surface design files"
      badge={prints.length ? <span className="badge-ok">{prints.length} files</span> : solid ? <span className="badge-ok">Solid, no print</span> : null}
    >
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center gap-3">
          <Palette size={18} className="text-muted" />
          <div>
            <div className="text-sm font-medium">Print file generator</div>
            <div className="text-xs text-muted">Pattern: {tp.pattern || "not set"}. Uses your colourways.</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted">What should we generate?</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button className={`chip ${kind === "repeat" ? "border-accent bg-accent-soft" : ""}`} onClick={() => setKind("repeat")}>
            <Repeat size={13} /> Repeat Â· seamless tile
          </button>
          <button className={`chip ${kind === "placement" ? "border-accent bg-accent-soft" : ""}`} onClick={() => setKind("placement")}>
            <Shapes size={13} /> Placement graphic
          </button>
        </div>
        <textarea
          className="input mt-3 min-h-16"
          placeholder={kind === "repeat" ? "e.g. tiny hand-drawn moons and stars, tonal, very subtle" : "e.g. small embroidered crescent moon logo, single line"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder={kind === "repeat" ? "Placement: all-over" : "Placement: left chest"} value={placement} onChange={(e) => setPlacement(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder={kind === "repeat" ? "Repeat width cm" : "Width cm"} value={w} onChange={(e) => setW(e.target.value)} />
          <input className="input" inputMode="decimal" placeholder={kind === "repeat" ? "Repeat height cm" : "Height cm"} value={h} onChange={(e) => setH(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            disabled={!!busy || !description.trim()}
            onClick={async () => {
              if (await run(base, "POST", { mode: "ai", description, ...meta }, "Creating print artworkâ€¦ about 30â€“60 seconds")) {
                setDescription("");
                setName("");
              }
            }}
          >
            <Wand2 size={14} /> Generate
          </button>
          <button className="btn" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Upload my artwork
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 3 * 1024 * 1024) return setError("That file is over 3 MB. Save it smaller (e.g. 2000 px PNG) and try again.");
              run(base, "POST", { mode: "upload", dataUrl: await readAsDataUrl(f), ...meta }, "Uploadingâ€¦");
            }}
          />
        </div>
      </div>

      {prints.length === 0 ? (
        <p className="mt-4 text-center text-xs text-muted">No print specs yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {prints.map((p) => (
            <li key={p.id} className="flex gap-3 rounded-xl border border-line p-3">
              <a href={fileUrl(product.id, p.file)} target="_blank" rel="noreferrer" className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(product.id, p.file)}
                  alt={p.name}
                  className="h-full w-full object-cover"
                  style={p.kind === "repeat" ? { imageRendering: "auto" } : undefined}
                />
              </a>
              <div className="min-w-0 flex-1 space-y-1 text-xs">
                <input
                  className="input py-1 text-sm font-medium"
                  defaultValue={p.name}
                  aria-label="Print name"
                  onBlur={(e) => e.target.value !== p.name && run(`${base}/${p.id}`, "PATCH", { name: e.target.value }, "Savingâ€¦")}
                />
                <div className="text-muted">
                  {p.kind === "repeat" ? "Seamless repeat" : "Placement"} Â· {p.source === "ai" ? "AI" : "Uploaded"}
                </div>
                <input
                  className="input py-1 text-xs"
                  defaultValue={p.placement}
                  aria-label="Placement"
                  onBlur={(e) => e.target.value !== p.placement && run(`${base}/${p.id}`, "PATCH", { placement: e.target.value }, "Savingâ€¦")}
                />
                <div className="flex items-center gap-1">
                  <input className="input w-16 py-1 text-xs" defaultValue={p.widthCm ?? ""} placeholder="W" aria-label="Width cm" onBlur={(e) => run(`${base}/${p.id}`, "PATCH", { widthCm: e.target.value }, "Savingâ€¦")} />
                  Ã—
                  <input className="input w-16 py-1 text-xs" defaultValue={p.heightCm ?? ""} placeholder="H" aria-label="Height cm" onBlur={(e) => run(`${base}/${p.id}`, "PATCH", { heightCm: e.target.value }, "Savingâ€¦")} />
                  cm
                  <div className="flex-1" />
                  <button className="btn btn-ghost px-2 text-danger" aria-label="Delete print" disabled={!!busy} onClick={() => confirm("Delete this print?") && run(`${base}/${p.id}`, "DELETE")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Status busy={busy} error={error} />
    </Section>
  );
}
