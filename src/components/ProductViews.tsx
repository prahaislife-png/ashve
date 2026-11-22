"use client";

import { RefreshCw, Wand2 } from "lucide-react";
import { MOCKUP_VIEWS, PRODUCT_VIEWS, Product, productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";

const LABEL: Record<(typeof PRODUCT_VIEWS)[number], string> = {
  "product-front": "Front View",
  "product-side": "Side View",
  "product-back": "Back View",
};

/** The three product renders (front / side / back) with generate + redo buttons. */
export default function ProductViews({
  product,
  run,
  busy,
  compact = false,
}: {
  product: Product;
  run: (url: string, method: string, body?: object, label?: string) => Promise<boolean>;
  busy: string | null;
  compact?: boolean;
}) {
  const views = productViews(product);
  const any = Object.keys(views).length > 0;
  const generating = busy?.startsWith("Rendering");

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="h-title text-lg">Product views</h2>
            <p className="text-xs text-muted">Front, side and back renders made from your tech pack</p>
          </div>
          <button
            className="btn btn-primary"
            disabled={!!busy || !product.techPack}
            onClick={() =>
              run(
                `/api/products/${product.id}/views`,
                "POST",
                {},
                "Rendering front, side and back… about 1 minute",
              )
            }
          >
            {any ? <RefreshCw size={14} /> : <Wand2 size={14} />}
            {any ? "Re-render all" : "Render views"}
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {PRODUCT_VIEWS.map((v) => {
          const m = views[v];
          return (
            <figure key={v} className="group">
              <figcaption className="mb-1.5 text-center text-xs text-muted">{LABEL[v]}</figcaption>
              <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
                {m ? (
                  <a href={fileUrl(product.id, m.file)} target="_blank" rel="noreferrer" className="h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl(product.id, m.file)}
                      alt={MOCKUP_VIEWS[v]}
                      className="h-full w-full object-contain"
                    />
                  </a>
                ) : (
                  <span className="px-2 text-center text-xs text-muted">
                    {generating ? "Rendering…" : product.techPack ? "Not rendered yet" : "Waiting for the tech pack"}
                  </span>
                )}
                {m && !compact && (
                  <button
                    className="btn absolute bottom-2 right-2 h-7 px-2 text-xs opacity-0 transition group-hover:opacity-100"
                    disabled={!!busy}
                    onClick={() =>
                      run(
                        `/api/products/${product.id}/views`,
                        "POST",
                        { only: v },
                        `Rendering ${LABEL[v].toLowerCase()}…`,
                      )
                    }
                  >
                    <RefreshCw size={12} /> Redo
                  </button>
                )}
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
