"use client";

import { ArrowRight, Check, ClipboardList, Layers, PencilLine, Printer, Tag } from "lucide-react";
import { OUTPUTS, OutputKey, Product, outputStatus } from "@/lib/schema";
import BasicSpecs from "@/components/specs/BasicSpecs";
import FlatSketches from "@/components/specs/FlatSketches";
import DetailedSpecs from "@/components/specs/DetailedSpecs";
import PrintFiles from "@/components/specs/PrintFiles";
import LabelsTags from "@/components/specs/LabelsTags";

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
    <ul className="space-y-1">
      {OUTPUTS.map((o) => (
        <li key={o.key}>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-card"
            onClick={() => onPick(o.key)}
          >
            <span className="text-muted">{ICONS[o.key]}</span>
            <span className="flex-1">{o.label}</span>
            {status[o.key] ? (
              <span className="badge-ok flex items-center gap-0.5">
                <Check size={10} /> Ready
              </span>
            ) : (
              <span className="text-[11px] text-muted">To do</span>
            )}
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
      <div className="canvas-dots flex h-[calc(100vh-57px)] items-center justify-center p-6 text-center text-sm text-muted">
        Describe the product in the Design step first. The specs are built from the tech pack.
      </div>
    );
  }

  const scrollTo = (k: OutputKey) =>
    document.getElementById(k)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="canvas-dots min-h-[calc(100vh-57px)]">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <div className="min-w-0 flex-1 space-y-10">
          <BasicSpecs product={product} onUpdate={onUpdate} />
          <FlatSketches product={product} onUpdate={onUpdate} />
          <DetailedSpecs product={product} onUpdate={onUpdate} />
          <PrintFiles product={product} onUpdate={onUpdate} />
          <LabelsTags product={product} onUpdate={onUpdate} />
          <div className="flex justify-end pb-10">
            <button className="btn btn-primary" onClick={goNext}>
              Continue to Hand off <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <aside className="sticky top-20 hidden h-fit w-64 shrink-0 lg:block">
          <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted">Outputs</div>
          <OutputsNav product={product} onPick={scrollTo} />
          <button className="btn btn-primary mt-4 w-full" onClick={goNext}>
            Continue to Hand off
          </button>
        </aside>
      </div>
    </div>
  );
}
