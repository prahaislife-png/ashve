"use client";

import { RefreshCw, Wand2 } from "lucide-react";
import { MOCKUP_VIEWS, PRODUCT_VIEWS, Product, productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import { COST, Cost } from "@/components/specs/Section";

const LABEL: Record<(typeof PRODUCT_VIEWS)[number], string> = {
  "product-front": "Front",
  "product-side": "Side",
  "product-back": "Back",
};

/** The three product renders (front / side / back) with generate and redo buttons. */
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="views-title" className="h-title text-[22px]">
              Product views
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-2">Front, side and back renders made from the tech pack</p>
          </div>
          <button
            className={`btn ${any ? "" : "btn-primary"}`}
            disabled={!!busy || !product.techPack}
            onClick={() =>
              run(
                `/api/products/${product.id}/views`,
                "POST",
                {},
                "Rendering front, side and back views. Usually about a minute",
              )
            }
          >
            {any ? <RefreshCw size={14} /> : <Wand2 size={14} />}
            {any ? "Re-render all" : "Render views"} <Cost usd={COST.views} />
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {PRODUCT_VIEWS.map((v) => {
          const m = views[v];
          return (
            <figure key={v} className="group">
              <div
                className={`artifact relative flex aspect-[4/5] items-center justify-center ${m ? "" : "drafting-grid"}`}
              >
                {m ? (
                  <a href={fileUrl(product.id, m.file)} target="_blank" rel="noreferrer" className="h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl(product.id, m.file)}
                      alt={`${MOCKUP_VIEWS[v]} render`}
                      className="h-full w-full object-contain p-2"
                    />
                  </a>
                ) : (
                  <span className="px-2 text-center text-[12.5px] text-muted">
                    {generating ? "Rendering…" : product.techPack ? "Not rendered yet" : "Waiting for the tech pack"}
                  </span>
                )}
                {m && !compact && (
                  <button
                    className="btn absolute bottom-2 right-2 h-7 min-h-0 px-2 text-[12px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    disabled={!!busy}
                    aria-label={`Redo ${LABEL[v].toLowerCase()} view`}
                    onClick={() =>
                      run(`/api/products/${product.id}/views`, "POST", { only: v }, `Rendering the ${LABEL[v].toLowerCase()} view`)
                    }
                  >
                    <RefreshCw size={12} /> Redo
                  </button>
                )}
              </div>
              <figcaption className="mt-2 text-[12.5px] text-ink-2">{LABEL[v]}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
