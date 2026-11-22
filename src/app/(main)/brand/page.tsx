"use client";

import { useEffect, useState } from "react";
import { Brand, emptyBrand } from "@/lib/schema";

type TextKey = Exclude<keyof Brand, "palette">;

const FIELDS: { key: TextKey; label: string; hint: string; long?: boolean }[] = [
  { key: "name", label: "Brand name", hint: "" },
  {
    key: "aesthetic",
    label: "Look & feel",
    hint: "e.g. Quiet luxury loungewear. Soft, minimal, neutral tones, clean finishes, no loud logos.",
    long: true,
  },
  {
    key: "customer",
    label: "Who she is",
    hint: "e.g. Women 25–45 who want comfortable pieces that still look put-together at home and for errands.",
    long: true,
  },
  {
    key: "fabrics",
    label: "Go-to fabrics",
    hint: "One per line, e.g.\nModal jersey 95/5 modal/elastane, 180 GSM, brushed\nCotton French terry 280 GSM\nBamboo rib 1x1, 220 GSM",
    long: true,
  },
  { key: "sizes", label: "Size range", hint: "e.g. XS, S, M, L, XL" },
  { key: "baseSize", label: "Base (sample) size", hint: "e.g. M" },
  {
    key: "baseMeasurements",
    label: "Base size body measurements (cm)",
    hint: "e.g. Bust 92, Waist 74, Hip 100, Height 168. Or the measurements of a favourite garment.",
    long: true,
  },
  {
    key: "fitNotes",
    label: "Fit rules",
    hint: "e.g. Relaxed not oversized. Tops hit at hip. Pants wide-leg, 78 cm inseam, high rise.",
    long: true,
  },
  {
    key: "labelNotes",
    label: "Labels",
    hint: "e.g. Printed neck label (no scratchy tags), woven brand label at back waist, care label left side seam.",
    long: true,
  },
  {
    key: "packagingNotes",
    label: "Packaging",
    hint: "e.g. Recycled poly bag, folded with tissue, hang tag on cotton string.",
    long: true,
  },
  { key: "targetFobUsd", label: "Target factory cost per piece (USD)", hint: "e.g. 12–18" },
  { key: "targetRetailUsd", label: "Target retail price (USD)", hint: "e.g. 68–98" },
  { key: "moqPerColor", label: "Order size per colour", hint: "e.g. 100–300 units" },
];

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand>(emptyBrand);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((b: Brand) => {
        setBrand(b);
        setLoaded(true);
      });
  }, []);

  function update<K extends keyof Brand>(key: K, value: Brand[K]) {
    setBrand((b) => ({ ...b, [key]: value }));
    setSaved("idle");
  }

  async function save() {
    setSaved("saving");
    await fetch("/api/brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });
    setSaved("saved");
  }

  if (!loaded) return <p className="p-8 text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-3xl">Brand DNA</h1>
      <p className="mt-1 text-sm text-muted">
        Saved once, used in every tech pack. The more specific, the better the first draft.
      </p>

      <div className="mt-6 space-y-5 rounded-xl border border-line bg-card p-5">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium">{f.label}</span>
            {f.long ? (
              <textarea
                className="input min-h-20"
                placeholder={f.hint}
                value={brand[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            ) : (
              <input
                className="input"
                placeholder={f.hint}
                value={brand[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            )}
          </label>
        ))}

        <div>
          <span className="mb-1 block text-sm font-medium">Colour palette</span>
          <div className="space-y-2">
            {brand.palette.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Colour"
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-card"
                  value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#d9d4c7"}
                  onChange={(e) => {
                    const palette = [...brand.palette];
                    palette[i] = { ...c, hex: e.target.value };
                    update("palette", palette);
                  }}
                />
                <input
                  className="input"
                  placeholder="Name, e.g. Oat"
                  value={c.name}
                  onChange={(e) => {
                    const palette = [...brand.palette];
                    palette[i] = { ...c, name: e.target.value };
                    update("palette", palette);
                  }}
                />
                <input
                  className="input"
                  placeholder="Pantone, e.g. 13-1008 TCX"
                  value={c.pantone}
                  onChange={(e) => {
                    const palette = [...brand.palette];
                    palette[i] = { ...c, pantone: e.target.value };
                    update("palette", palette);
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  aria-label="Remove colour"
                  onClick={() => update("palette", brand.palette.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() =>
                update("palette", [...brand.palette, { name: "", pantone: "", hex: "#d9d4c7" }])
              }
            >
              + Add colour
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 bg-bg py-3">
        {saved === "saved" && <span className="text-sm text-accent">Saved</span>}
        <button className="btn btn-primary" onClick={save} disabled={saved === "saving"}>
          {saved === "saving" ? "Saving…" : "Save Brand DNA"}
        </button>
      </div>
    </div>
  );
}
