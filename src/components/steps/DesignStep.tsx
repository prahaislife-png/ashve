"use client";

import { ArrowRight } from "lucide-react";
import { Product } from "@/lib/schema";
import { useAction } from "@/lib/useAction";
import ChatPanel, { Brief } from "@/components/ChatPanel";
import ProductViews from "@/components/ProductViews";
import MockupPanel from "@/components/MockupPanel";
import { Status } from "@/components/specs/Section";

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
  const { run, busy, error, job } = useAction(onUpdate);

  return (
    <div className="flex h-[calc(100vh-57px)] min-h-0">
      <ChatPanel
        className="w-full max-w-[400px] shrink-0 border-r border-line bg-panel max-md:hidden"
        product={product}
        onUpdate={onUpdate}
        initialBrief={initialBrief}
        onFirstTechPack={(p) =>
          run(`/api/products/${p.id}/views`, "POST", {}, "Rendering front, side and back views. Usually about a minute")
        }
      />

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-8">
          {/* Phones: the assistant sits above the views */}
          <div className="card mb-8 h-[70vh] overflow-hidden md:hidden">
            <ChatPanel product={product} onUpdate={onUpdate} className="h-full" />
          </div>

          <section aria-labelledby="views-title">
            <ProductViews product={product} run={run} busy={busy} />
            <Status busy={busy} error={error} job={job} />
          </section>

          {product.techPack && (
            <section className="mt-12 border-t border-line pt-7">
              <MockupPanel product={product} onUpdate={onUpdate} />
            </section>
          )}

          {product.techPack && (
            <div className="mt-12 flex justify-end border-t border-line pt-6">
              <button className="btn btn-primary" onClick={goNext}>
                Continue to specs <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
