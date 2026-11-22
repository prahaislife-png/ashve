"use client";

import { useRef, useState } from "react";
import { MapPin, Sparkles, Trash2, ZoomIn } from "lucide-react";
import { DetailPin, MOCKUP_VIEWS, Product, productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import { useAction } from "@/lib/useAction";
import { COST, Cost, Section, Status, Tabs } from "./Section";

type Tab = "detail" | "closeup" | "component";

export function PinnedImage({
  src,
  pins,
  selected,
  onPick,
  onAdd,
}: {
  src: string;
  pins: DetailPin[];
  selected?: string | null;
  onPick?: (id: string) => void;
  onAdd?: (x: number, y: number) => void;
}) {
  return (
    <div
      className={`relative mx-auto w-full max-w-md select-none ${onAdd ? "cursor-crosshair" : ""}`}
      onClick={(e) => {
        if (!onAdd) return;
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        onAdd(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Product" className="w-full rounded-lg" draggable={false} />
      {pins.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPick?.(p.id);
          }}
          className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow ${
            selected === p.id ? "border-white bg-pin text-white" : "border-pin bg-white text-pin"
          }`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          aria-label={`Detail ${p.n}: ${p.title}`}
        >
          {p.n}
        </button>
      ))}
    </div>
  );
}

export default function DetailedSpecs({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const tp = product.techPack!;
  const [tab, setTab] = useState<Tab>("detail");
  const [selected, setSelected] = useState<string | null>(null);
  const selectNewest = useRef(false);
  const { run, busy, error } = useAction((p) => {
    onUpdate(p);
    if (selectNewest.current) {
      selectNewest.current = false;
      const newest = [...(p.details ?? [])].sort((a, b) => b.n - a.n)[0];
      if (newest) setSelected(newest.id);
    }
  });
  const views = productViews(product);
  const images = [
    ...Object.values(views).filter(Boolean),
    ...(product.mockups ?? []).filter((m) => !m.view.startsWith("product-")),
  ] as NonNullable<Product["mockups"]>;
  const [imageFile, setImageFile] = useState<string | null>(views["product-front"]?.file ?? images[0]?.file ?? null);
  const pins = product.details ?? [];
  const image = imageFile && images.find((m) => m.file === imageFile) ? imageFile : (images[0]?.file ?? null);
  const pinsHere = pins.filter((p) => p.image === image);
  const sel = pins.find((p) => p.id === selected) ?? null;
  const base = `/api/products/${product.id}/details`;

  return (
    <Section
      id="details"
      title="Detailed specs"
      subtitle="Numbered callouts on the product, close-ups of each detail, and every component"
      badge={pins.length ? <span className="badge-ok">{pins.length} details</span> : null}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "detail", label: "Detail view" },
          { key: "closeup", label: "Close-ups" },
          { key: "component", label: "Components" },
        ]}
      />

      <div className="mt-4">
        {tab === "detail" &&
          (images.length === 0 ? (
            <p className="text-sm text-muted">Render the product views first (Design step or Basic Product Specs).</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setImageFile(m.file)}
                      className={`h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-artifact shadow-elev-sm ${image === m.file ? "ring-2 ring-accent" : ""}`}
                      title={MOCKUP_VIEWS[m.view]}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(product.id, m.file)} alt={MOCKUP_VIEWS[m.view]} className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
                {image && (
                  <PinnedImage
                    src={fileUrl(product.id, image)}
                    pins={pinsHere}
                    selected={selected}
                    onPick={setSelected}
                    onAdd={(x, y) => {
                      if (busy) return;
                      selectNewest.current = true;
                      run(base, "POST", { action: "add", image, x, y, title: "New detail" }, "Adding pin…");
                    }}
                  />
                )}
                <p className="mt-2 text-center text-xs text-muted">Click on the image to drop a pin. Click a pin to edit it.</p>
              </div>

              <div className="space-y-3">
                <button
                  className="btn btn-primary w-full"
                  disabled={!!busy || !image}
                  onClick={() => run(base, "POST", { action: "suggest", image }, "Finding the key details… about 30 seconds")}
                >
                  <Sparkles size={14} /> Find details with AI <Cost usd={COST.details} />
                </button>
                {sel ? (
                  <div className="rounded-xl bg-card p-3 shadow-elev-sm">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                      <MapPin size={13} /> Detail {sel.n}
                    </div>
                    <input
                      key={`t-${sel.id}`}
                      className="input mb-2"
                      defaultValue={sel.title}
                      aria-label="Detail name"
                      onBlur={(e) => e.target.value !== sel.title && run(`${base}/${sel.id}`, "PATCH", { title: e.target.value }, "Saving…")}
                    />
                    <textarea
                      key={`n-${sel.id}`}
                      className="input min-h-24"
                      placeholder="Spec for the factory: stitch, size, finish…"
                      defaultValue={sel.note}
                      aria-label="Detail note"
                      onBlur={(e) => e.target.value !== sel.note && run(`${base}/${sel.id}`, "PATCH", { note: e.target.value }, "Saving…")}
                    />
                    {sel.closeup && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(product.id, sel.closeup)} alt={`${sel.title} close-up`} className="mt-2 w-full rounded-lg" />
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn flex-1"
                        disabled={!!busy}
                        onClick={() => run(`${base}/${sel.id}`, "POST", {}, "Making a close-up… about 30 seconds")}
                      >
                        <ZoomIn size={14} /> {sel.closeup ? "Redo close-up" : "Make close-up"} <Cost usd={COST.closeup} />
                      </button>
                      <button
                        className="btn text-danger"
                        aria-label="Delete detail"
                        disabled={!!busy}
                        onClick={async () => {
                          if (await run(`${base}/${sel.id}`, "DELETE", undefined, "Deleting…")) setSelected(null);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
                    Pin a seam, stitch, trim or label on the image, or let AI find them. Each pin becomes a numbered callout in the tech pack.
                  </div>
                )}
                <ol className="space-y-1 text-sm">
                  {pinsHere.map((p) => (
                    <li key={p.id}>
                      <button className={`w-full rounded-lg px-2 py-1 text-left hover:bg-accent-soft ${selected === p.id ? "bg-accent-soft" : ""}`} onClick={() => setSelected(p.id)}>
                        <span className="mr-1.5 font-bold text-pin">{p.n}</span>
                        {p.title}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}

        {tab === "closeup" &&
          (pins.length === 0 ? (
            <p className="text-sm text-muted">Add detail pins first (Detail view tab).</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pins.map((p) => (
                <li key={p.id} className="artifact">
                  <div className="drafting-grid flex aspect-square items-center justify-center">
                    {p.closeup ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(product.id, p.closeup)} alt={`${p.title} close-up`} className="h-full w-full object-cover" />
                    ) : (
                      <button className="btn" disabled={!!busy} onClick={() => run(`${base}/${p.id}`, "POST", {}, `Making close-up of ${p.title}…`)}>
                        <ZoomIn size={14} /> Make close-up <Cost usd={COST.closeup} />
                      </button>
                    )}
                  </div>
                  <div className="p-2.5 text-[12.5px] text-[#1f2430]">
                    <div className="font-medium">
                      <span className="mr-1 text-pin">{p.n}</span>
                      {p.title}
                    </div>
                    <div className="mt-0.5 line-clamp-3 text-[#5b6270]">{p.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === "component" && (
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {tp.trims.map((t, i) => (
              <li key={i} className="border-b border-line py-3">
                <div className="font-medium">{t.item}</div>
                <div className="mt-0.5 text-muted">{t.description}</div>
                <div className="mt-1.5 flex gap-4 text-[12.5px] text-muted">
                  <span>Placement: {t.placement}</span>
                  <span>Qty: {t.quantity}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Status busy={busy} error={error} />
    </Section>
  );
}
