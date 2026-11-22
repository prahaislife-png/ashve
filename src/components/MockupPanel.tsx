"use client";

import { useState } from "react";
import { MOCKUP_VIEWS, MockupView, PRODUCT_VIEWS, Product } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";

export default function MockupPanel({
  product,
  onUpdate,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
}) {
  const tp = product.techPack;
  const mockups = [...(product.mockups ?? [])]
    .filter((m) => !(PRODUCT_VIEWS as readonly string[]).includes(m.view))
    .reverse();
  const refs = product.messages.flatMap((m) => m.images ?? []);

  const [view, setView] = useState<MockupView>("flat-front");
  const [colorway, setColorway] = useState(tp?.colorways[0]?.name ?? "");
  const [note, setNote] = useState("");
  const [useRefs, setUseRefs] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");

  async function call(url: string, method: string, body?: object, label = "Working…") {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return false;
      }
      onUpdate(data);
      return true;
    } catch {
      setError("Couldn't reach the app server.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (!tp) return null;

  return (
    <div className="no-print">
      <div>
        <h2 className="h-title text-lg">Mockups & campaign shots</h2>
        <p className="text-xs text-muted">Flat lays, on-model and lifestyle images for briefs, decks and Instagram</p>
      </div>

      <form
        className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await call(
            `/api/products/${product.id}/mockups`,
            "POST",
            { view, colorway, note, useReferences: useRefs && refs.length > 0 },
            "Creating image… about 30–60 seconds",
          );
          if (ok) setNote("");
        }}
      >
        <select
          className="input"
          value={view}
          aria-label="View"
          onChange={(e) => setView(e.target.value as MockupView)}
        >
          {Object.entries(MOCKUP_VIEWS)
            .filter(([k]) => !(PRODUCT_VIEWS as readonly string[]).includes(k))
            .map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={colorway}
          aria-label="Colourway"
          onChange={(e) => setColorway(e.target.value)}
        >
          {tp.colorways.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Optional direction, e.g. “sleeves pushed up, cosy sofa”"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn btn-primary justify-center" disabled={!!busy}>
          Create image
        </button>
      </form>
      {refs.length > 0 && (
        <label className="mt-2 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={useRefs} onChange={(e) => setUseRefs(e.target.checked)} />
          Use my reference photos as a guide ({Math.min(refs.length, 3)} most recent)
        </label>
      )}

      {busy && <p className="mt-3 text-sm text-muted">{busy}</p>}
      {error && <p className="mt-3 rounded-lg bg-warn-soft p-2.5 text-sm text-warn-ink">{error}</p>}

      {mockups.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {mockups.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-lg border border-line">
              <a href={fileUrl(product.id, m.file)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(product.id, m.file)}
                  alt={`${MOCKUP_VIEWS[m.view]} in ${m.colorway}`}
                  className="aspect-[2/3] w-full bg-accent-soft object-cover"
                />
              </a>
              <div className="space-y-2 p-2 text-xs">
                <div className="font-medium">
                  {MOCKUP_VIEWS[m.view]} · {m.colorway}
                  {m.editedFrom ? " · edited" : ""}
                </div>
                {m.note && <div className="text-muted">“{m.note}”</div>}
                <div className="flex flex-wrap gap-1">
                  <label className="flex items-center gap-1 text-muted">
                    <input
                      type="checkbox"
                      checked={m.inPdf}
                      disabled={!!busy}
                      onChange={(e) =>
                        call(`/api/products/${product.id}/mockups/${m.id}`, "PATCH", {
                          inPdf: e.target.checked,
                        })
                      }
                    />
                    In PDF
                  </label>
                  <div className="flex-1" />
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => {
                      setEditing(editing === m.id ? null : m.id);
                      setInstruction("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    disabled={!!busy}
                    onClick={() =>
                      confirm("Delete this image?") &&
                      call(`/api/products/${product.id}/mockups/${m.id}`, "DELETE")
                    }
                  >
                    Delete
                  </button>
                </div>
                {editing === m.id && (
                  <form
                    className="flex gap-1"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await call(
                        `/api/products/${product.id}/mockups/${m.id}`,
                        "POST",
                        { instruction },
                        "Editing image… about 30–60 seconds",
                      );
                      if (ok) setEditing(null);
                    }}
                  >
                    <input
                      className="input py-1 text-xs"
                      autoFocus
                      placeholder="e.g. make it sage green"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                    <button className="btn px-2 py-1 text-xs" disabled={!!busy || !instruction.trim()}>
                      Go
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
