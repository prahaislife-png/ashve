"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, ArrowUp, X, Lightbulb, Shirt, Layers, Moon } from "lucide-react";
import { resizePhoto } from "@/lib/useAction";

const STARTERS: { icon: React.ReactNode; label: string; prompt: string }[] = [
  {
    icon: <Layers size={13} />,
    label: "Lounge set",
    prompt: "Relaxed lounge set: oversized long-sleeve crew top and wide-leg drawstring pants in brushed modal jersey.",
  },
  {
    icon: <Moon size={13} />,
    label: "Slip dress",
    prompt: "Bias-cut modal slip dress, midi length, adjustable straps, soft cowl neck.",
  },
  {
    icon: <Shirt size={13} />,
    label: "Crop hoodie",
    prompt: "Cropped French terry hoodie with dropped shoulders and a raw-edge hem.",
  },
  {
    icon: <Lightbulb size={13} />,
    label: "Tie-strap cami set",
    prompt: "Tie-strap crop camisole with gathered bust and a flared hem, with matching wide-leg pull-on palazzo pants in crinkle rayon.",
  },
];

export const PENDING_KEY = (id: string) => `pending-brief:${id}`;

export default function CreateBox({
  hasBrand,
  collections = [],
}: {
  hasBrand: boolean;
  collections?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [useBrand, setUseBrand] = useState(hasBrand);
  const [busy, setBusy] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 4 - photos.length);
    try {
      const resized = await Promise.all(picked.map((f) => resizePhoto(f)));
      setPhotos((p) => [...p, ...resized].slice(0, 4));
    } catch {
      setError("Couldn't read that photo. Try a JPEG or PNG.");
    }
  }

  async function create() {
    if ((!text.trim() && photos.length === 0) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const name = text.trim().split(/[,.:;\n]/)[0].split(/\s+/).slice(0, 6).join(" ") || "New piece";
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, useBrand }),
      });
      const product = await res.json();
      if (!res.ok) throw new Error(product.error ?? "Couldn't create the product.");
      if (collectionId) {
        await fetch(`/api/collections/${collectionId}/pieces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", productId: product.id }),
        }).catch(() => {});
      }
      try {
        sessionStorage.setItem(PENDING_KEY(product.id), JSON.stringify({ text: text.trim(), photos }));
      } catch {
        // storage full or blocked: the product page will just open empty
      }
      router.push(`/products/${product.id}?step=design`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 text-left">
      <div className="card p-3 focus-within:shadow-elev-lg transition-shadow">
        <textarea
          className="min-h-28 w-full resize-none bg-transparent p-1.5 text-[15.5px] outline-none placeholder:text-muted"
          aria-label="Describe your product"
          placeholder="Relaxed linen-blend lounge pant, wide leg, drawstring waist, muted sage, sizes XS to XL"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              create();
            }
          }}
        />
        {photos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Reference" className="h-16 w-16 rounded-lg object-cover" />
                <button
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost px-2"
            title="Add reference photos or sketches"
            onClick={() => fileInput.current?.click()}
            disabled={photos.length >= 4}
          >
            <ImagePlus size={16} /> <span className="hidden sm:inline">Photo</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] text-ink-2">
            <span>Use Brand DNA</span>
            <button
              type="button"
              role="switch"
              aria-checked={useBrand}
              aria-label="Use Brand DNA"
              onClick={() => setUseBrand((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition ${useBrand ? "bg-accent" : "bg-line-strong"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${useBrand ? "left-4.5" : "left-0.5"}`}
              />
            </button>
          </label>
          {!hasBrand && (
            <Link href="/brand" className="text-[12.5px] text-accent hover:underline">
              Set up
            </Link>
          )}
          {collections.length > 0 && (
            <select
              className="input ml-1 h-8 w-auto max-w-44 py-0.5 text-[13px]"
              aria-label="Collection"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex-1" />
          <button
            className="btn btn-primary"
            disabled={busy || (!text.trim() && photos.length === 0)}
            onClick={create}
          >
            Create product <span className="cost">≈ $0.30</span> <ArrowUp size={15} />
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      {busy && (
        <p className="mt-2 text-sm text-muted" role="status">
          Opening your product…
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-muted">Start from</span>
        {STARTERS.map((s) => (
          <button key={s.label} className="chip" aria-pressed={text === s.prompt} onClick={() => setText(s.prompt)}>
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
