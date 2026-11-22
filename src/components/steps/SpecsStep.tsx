"use client";

import { ArrowRight, Check, ClipboardList, Layers, PencilLine, Printer, Tag } from "lucide-react";
import { OUTPUTS, OutputKey, Product, outputStatus } from "@/lib/schema";
import BasicSpecs from "@/components/specs/BasicSpecs";
import FlatSketches from "@/components/specs/FlatSketches";
import DetailedSpecs from "@/components/specs/DetailedSpecs";
import PrintFiles from "@/components/specs/PrintFiles";
import LabelsTags from "@/components/specs/LabelsTags";
import TitleBlock from "@/components/TitleBlock";

const ICONS: Record<OutputKey, React.ReactNode> = {
  basic: <ClipboardList size={15} />,
  flats: <PencilLine size={15} />,
  details: <Layers size={15} />,
  print: <Printer size={15} />,
  labels: <Tag size={15} />,
};

export function OutputsNav({ product, onPick }: { product: Product; onPick: (k: OutputKey) => void }) {
  const status = outputStatus(product);
  return (
    <ul className="space-y-px">
      {OUTPUTS.map((o) => (
        <li key={o.key}>
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-2 transition-colors hover:bg-card hover:text-ink"
            onClick={() => onPick(o.key)}
          >
            <span className={status[o.key] ? "text-ok" : "text-muted"}>
              {status[o.key] ? <Check size={15} /> : ICONS[o.key]}
            </span>
            <span className="flex-1">{o.label}</span>
            {!status[o.key] && <span className="text-[12px] text-muted">To do</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function SpecsStep({
  product,
  onUpdate,
  goNext,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  goNext: () => void;
}) {
  if (!product.techPack) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center p-6 text-center text-ink-2">
        Describe the product in the Design step first. The specs are built from it.
      </div>
    );
  }

  const status = outputStatus(product);
  const done = OUTPUTS.filter((o) => status[o.key]).length;
  const scrollTo = (k: OutputKey) =>
    document.getElementById(k)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-[calc(100vh-57px)]">
      <div className="mx-auto flex max-w-6xl gap-10 px-5 py-8">
        <div className="min-w-0 flex-1">
          <TitleBlock product={product} />

          {/* Phones and tablets: outputs as a scrollable row */}
          <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:hidden">
            {OUTPUTS.map((o) => (
              <button key={o.key} className="chip shrink-0" onClick={() => scrollTo(o.key)}>
                <span className={status[o.key] ? "text-ok" : "text-muted"}>
                  {status[o.key] ? <Check size={13} /> : ICONS[o.key]}
                </span>
                {o.label}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-12">
            <BasicSpecs product={product} onUpdate={onUpdate} />
            <FlatSketches product={product} onUpdate={onUpdate} />
            <DetailedSpecs product={product} onUpdate={onUpdate} />
            <PrintFiles product={product} onUpdate={onUpdate} />
            <LabelsTags product={product} onUpdate={onUpdate} />
          </div>

          <div className="mt-12 flex justify-end border-t border-line pb-16 pt-6">
            <button className="btn btn-primary" onClick={goNext}>
              Continue to hand off <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <aside className="sticky top-[81px] hidden h-fit w-60 shrink-0 lg:block" aria-label="Outputs">
          <div className="mb-2 flex items-baseline justify-between px-2.5">
            <span className="text-[13px] font-medium text-ink">Outputs</span>
            <span className="num text-[12.5px] text-muted">
              {done} of {OUTPUTS.length}
            </span>
          </div>
          <OutputsNav product={product} onPick={scrollTo} />
          <button className="btn btn-primary mt-4 w-full" onClick={goNext}>
            Continue to hand off
          </button>
        </aside>
      </div>
    </div>
  );
}
