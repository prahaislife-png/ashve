"use client";

import { ArrowRight } from "lucide-react";
import { Product } from "@/lib/schema";
import { useAction } from "@/lib/useAction";
import ChatPanel, { Brief } from "@/components/ChatPanel";
import ProductViews from "@/components/ProductViews";
import MockupPanel from "@/components/MockupPanel";

export default function DesignStep({
  product,
  onUpdate,
  initialBrief,
  goNext,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  initialBrief: Brief | null;
  goNext: () => void;
}) {
  const { run, busy, error } = useAction(onUpdate);

  return (
    <div className="flex h-[calc(100vh-57px)] min-h-0">
      <ChatPanel
        className="w-full max-w-[400px] shrink-0 border-r border-line bg-panel max-md:hidden"
        product={product}
        onUpdate={onUpdate}
        initialBrief={initialBrief}
        onFirstTechPack={(p) =>
          run(`/api/products/${p.id}/views`, "POST", {}, "Rendering front, side and back… about 1 minute")
        }
      />

      <div className="canvas-dots min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
          {/* mobile: chat inline */}
          <div className="card h-[70vh] overflow-hidden md:hidden">
            <ChatPanel product={product} onUpdate={onUpdate} className="h-full" />
          </div>

          <div className="card p-5">
            <ProductViews product={product} run={run} busy={busy} />
            {busy && <p className="mt-3 text-sm text-muted">{busy}</p>}
            {error && <p className="mt-3 rounded-lg bg-warn-soft p-2.5 text-sm text-warn-ink">{error}</p>}
          </div>

          {product.techPack && (
            <div className="card p-5">
              <MockupPanel product={product} onUpdate={onUpdate} />
            </div>
          )}

          {product.techPack && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={goNext}>
                Continue to Specs <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
