"use client";

import { useState } from "react";
import { Product } from "@/lib/schema";
import { useAction } from "@/lib/useAction";
import ProductViews from "@/components/ProductViews";
import { Field, Section, Status, Swatch, Tabs } from "./Section";

type Tab = "info" | "colours" | "materials" | "construction";

export default function BasicSpecs({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const tp = product.techPack!;
  const [tab, setTab] = useState<Tab>("info");
  const { run, busy, error } = useAction(onUpdate);

  return (
    <Section
      id="basic"
      title="Basic product specs"
      subtitle="Product information, colours, materials and construction, written from your brief"
    >
      <ProductViews product={product} run={run} busy={busy} compact />
      <Status busy={busy} error={error} />

      {tp.openQuestions.length > 0 && (
        <div className="mt-6 rounded-lg border-l-[3px] border-warn bg-warn-soft px-4 py-3 text-[13.5px] text-warn-ink">
          <p className="font-medium">
            {tp.openQuestions.length} {tp.openQuestions.length === 1 ? "decision" : "decisions"} before this goes to a
            factory
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {tp.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px]">Answer them in the assistant and the tech pack updates.</p>
        </div>
      )}

      <div className="mt-7">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "info", label: "Product information" },
            { key: "colours", label: "Colours & pattern" },
            { key: "materials", label: "Materials" },
            { key: "construction", label: "Construction & trims" },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === "info" && (
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <Field label="Category" value={tp.category} />
            <Field label="Subcategory" value={tp.subcategory} />
            <Field label="Product type" value={tp.productType} />
            <Field
              label="Estimated weight (size M)"
              value={tp.estimatedWeightG ? `${tp.estimatedWeightG} g` : ""}
            />
            <Field label="Style number" value={tp.styleNumber} />
            <Field label="Season" value={tp.season} />
            <div className="sm:col-span-2">
              <Field label="Style description" value={tp.description} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Fit" value={tp.fit} />
            </div>
            <Field label="Intended use" value={tp.intendedUse} />
            <Field label="Target market" value={tp.targetMarket} />
            <Field label="Sizes" value={`${tp.sizes.join(", ")} (sample size ${tp.baseSize})`} />
            <Field
              label="Costing targets"
              value={[
                tp.costing.targetFobUsd != null && `FOB $${tp.costing.targetFobUsd}`,
                tp.costing.targetRetailUsd != null && `Retail $${tp.costing.targetRetailUsd}`,
                tp.costing.moqPerColor != null && `MOQ ${tp.costing.moqPerColor}/colour`,
              ]
                .filter(Boolean)
                .join(", ")}
            />
          </dl>
        )}

        {tab === "colours" && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-ink-2">Colourways</h3>
              <div className="grid gap-x-6 sm:grid-cols-3">
                {tp.colorways.map((c, i) => (
                  <Swatch key={i} name={c.name} hex={c.hex} sub={c.pantone ? `${c.pantone}  ${c.hex}` : c.hex} />
                ))}
              </div>
            </div>
            {tp.accentColors.length > 0 && (
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-ink-2">Trim and hardware colours</h3>
                <div className="grid gap-x-6 sm:grid-cols-3">
                  {tp.accentColors.map((c, i) => (
                    <Swatch key={i} name={c.name} hex={c.hex} sub={c.pantone || c.hex} />
                  ))}
                </div>
              </div>
            )}
            <dl>
              <Field label="Pattern or texture" value={tp.pattern} />
            </dl>
          </div>
        )}

        {tab === "materials" && (
          <div className="overflow-x-auto">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Material</th>
                  <th>Construction</th>
                  <th>GSM</th>
                  <th>Finish</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tp.fabrics.map((f, i) => (
                  <tr key={i}>
                    <td className="font-medium">{f.placement}</td>
                    <td>{f.composition}</td>
                    <td>{f.construction}</td>
                    <td>{f.weightGsm ?? "—"}</td>
                    <td>{f.finish}</td>
                    <td className="text-muted">{f.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "construction" && (
          <div className="space-y-5">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {tp.construction.map((c, i) => (
                  <tr key={i}>
                    <td className="w-1/4 font-medium">{c.area}</td>
                    <td>{c.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="overflow-x-auto">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Trim / component</th>
                    <th>Description</th>
                    <th>Placement</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {tp.trims.map((t, i) => (
                    <tr key={i}>
                      <td className="font-medium">{t.item}</td>
                      <td>{t.description}</td>
                      <td>{t.placement}</td>
                      <td>{t.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
