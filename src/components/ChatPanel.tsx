"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, ArrowUp, X, Sparkles } from "lucide-react";
import { Product } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import { resizePhoto } from "@/lib/useAction";

const MAX_PHOTOS = 4;

export type Brief = { text: string; photos: string[] };

export default function ChatPanel({
  product,
  onUpdate,
  initialBrief,
  onFirstTechPack,
  className = "",
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  /** A brief from the Create page to send automatically */
  initialBrief?: Brief | null;
  /** Called after the first tech pack has been created */
  onFirstTechPack?: (p: Product) => void;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [product.messages.length, pending]);

  useEffect(() => {
    if (initialBrief && !sentInitial.current && product.messages.length === 0) {
      sentInitial.current = true;
      send(initialBrief.text, initialBrief.photos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrief]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - photos.length);
    try {
      const resized = await Promise.all(picked.map((f) => resizePhoto(f)));
      setPhotos((p) => [...p, ...resized].slice(0, MAX_PHOTOS));
    } catch {
      setError("Couldn't read that photo. Try a JPEG or PNG.");
    }
  }

  async function send(text: string, sentPhotos: string[]) {
    if ((!text.trim() && sentPhotos.length === 0) || sending) return;
    const hadTechPack = !!product.techPack;
    setSending(true);
    setError(null);
    setPending({ text, photos: sentPhotos });
    setMessage("");
    setPhotos([]);
    try {
      const res = await fetch(`/api/products/${product.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, images: sentPhotos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setMessage(text);
        setPhotos(sentPhotos);
      } else {
        onUpdate(data);
        if (!hadTechPack && data.techPack) onFirstTechPack?.(data);
      }
    } catch {
      setError("Couldn't reach the app server.");
      setMessage(text);
      setPhotos(sentPhotos);
    } finally {
      setSending(false);
      setPending(null);
    }
  }

  const Photos = ({ srcs }: { srcs: string[] }) =>
    srcs.length ? (
      <div className="mb-2 flex flex-wrap gap-1.5">
        {srcs.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="Reference" className="h-16 w-16 rounded-md object-cover" />
        ))}
      </div>
    ) : null;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Sparkles size={15} className="text-accent" />
        <span className="text-sm font-medium">Design assistant</span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {product.messages.length === 0 && !pending && (
          <p className="text-muted">
            Describe the piece like you’d explain it to a friend: fabric, fit, length, details. Add
            photos or a sketch if you have them.
          </p>
        )}
        {product.messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-xl p-3 leading-relaxed ${
              m.role === "user" ? "ml-6 bg-accent-soft" : "mr-6 border border-line bg-card"
            }`}
          >
            <Photos srcs={(m.images ?? []).map((n) => fileUrl(product.id, n))} />
            {m.content}
          </div>
        ))}
        {pending && (
          <>
            <div className="ml-6 whitespace-pre-wrap rounded-xl bg-accent-soft p-3">
              <Photos srcs={pending.photos} />
              {pending.text}
            </div>
            <div className="mr-6 flex items-center gap-2 rounded-xl border border-line bg-card p-3 text-muted">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              {product.techPack ? "Updating the tech pack…" : "Writing your tech pack… about a minute"}
            </div>
          </>
        )}
        {error && <div className="rounded-xl bg-warn-soft p-3 text-warn-ink">{error}</div>}
        <div ref={end} />
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(message, photos);
        }}
      >
        {photos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {photos.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Attached photo" className="h-14 w-14 rounded-md object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="card flex items-end gap-1 p-1.5">
          <button
            type="button"
            className="btn btn-ghost h-8 w-8 p-0"
            aria-label="Add photo"
            disabled={sending || photos.length >= MAX_PHOTOS}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={16} />
          </button>
          <textarea
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none"
            rows={2}
            placeholder={product.techPack ? "Ask for a change…" : "Describe your piece…"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(message, photos);
              }
            }}
          />
          <button
            className="btn btn-primary h-8 w-8 rounded-full p-0"
            aria-label="Send"
            disabled={sending || (!message.trim() && photos.length === 0)}
          >
            <ArrowUp size={15} />
          </button>
        </div>
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
      </form>
    </div>
  );
}
