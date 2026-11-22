"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, MessageSquare, MoreVertical, Trash2, X } from "lucide-react";
import { OutputKey, Product } from "@/lib/schema";
import { Brief } from "@/components/ChatPanel";
import ChatPanel from "@/components/ChatPanel";
import DesignStep from "@/components/steps/DesignStep";
import SpecsStep from "@/components/steps/SpecsStep";
import HandoffStep from "@/components/steps/HandoffStep";
import { PENDING_KEY } from "@/components/CreateBox";

type Step = "design" | "specs" | "handoff";
const STEPS: { key: Step; label: string }[] = [
  { key: "design", label: "Design" },
  { key: "specs", label: "Specs" },
  { key: "handoff", label: "Hand off" },
];

export default function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = use(params);
  const sp = use(searchParams);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [step, setStepState] = useState<Step>(
    sp.step === "specs" || sp.step === "handoff" ? sp.step : "design",
  );
  const [brief, setBrief] = useState<Brief | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Product | null) => {
        setProduct(p);
        if (p && !sp.step) setStepState(p.techPack ? "specs" : "design");
      });
    try {
      const raw = sessionStorage.getItem(PENDING_KEY(id));
      if (raw) {
        sessionStorage.removeItem(PENDING_KEY(id));
        setBrief(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Lets the usage monitor move out of the way of the chat drawer.
  useEffect(() => {
    const open = chatOpen && step !== "design";
    document.body.dataset.drawer = open ? "open" : "closed";
    return () => {
      document.body.dataset.drawer = "closed";
    };
  }, [chatOpen, step]);

  function setStep(s: Step) {
    setStepState(s);
    router.replace(`/products/${id}?step=${s}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  function openSpecs(k: OutputKey) {
    setStep("specs");
    setTimeout(() => document.getElementById(k)?.scrollIntoView({ behavior: "smooth" }), 150);
  }

  async function rename(name: string) {
    if (!product || !name.trim() || name === product.name) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) setProduct(await res.json());
  }

  if (product === undefined) return <p className="p-8 text-sm text-muted">Loading…</p>;
  if (product === null)
    return (
      <p className="p-8 text-sm">
        This product doesn’t exist. <Link className="underline" href="/workspace">Back to workspace</Link>
      </p>
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-[57px] items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur-md">
        <Link href="/workspace" className="btn btn-ghost h-8 w-8 p-0" aria-label="Back to all products">
          <ChevronLeft size={17} />
        </Link>
        <input
          key={product.name}
          className="w-28 min-w-0 truncate rounded-md bg-transparent px-1.5 py-1 text-[14px] font-medium outline-none hover:bg-panel focus:bg-card sm:w-56"
          defaultValue={product.name}
          aria-label="Product name"
          onBlur={(e) => rename(e.target.value)}
        />
        <div className="relative">
          <button className="btn btn-ghost h-8 w-8 p-0" aria-label="More" onClick={() => setMenu((m) => !m)}>
            <MoreVertical size={16} />
          </button>
          {menu && (
            <div className="card absolute left-0 top-9 z-40 w-44 p-1">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-accent-soft"
                onClick={async () => {
                  if (!confirm(`Delete “${product.name}” and all its files? This can't be undone.`)) return;
                  await fetch(`/api/products/${id}`, { method: "DELETE" });
                  router.push("/workspace");
                  router.refresh();
                }}
              >
                <Trash2 size={14} /> Delete product
              </button>
            </div>
          )}
        </div>

        <nav className="mx-auto flex h-full items-stretch gap-0.5 text-[13.5px]" aria-label="Steps">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              {i > 0 && <span className="mx-2 hidden h-px w-6 bg-line-strong sm:block" aria-hidden="true" />}
              <button
                onClick={() => setStep(s.key)}
                aria-current={step === s.key ? "step" : undefined}
                className={`relative flex h-full items-center gap-2 px-2 ${
                  step === s.key ? "font-medium text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <span className={`code text-[12px] ${step === s.key ? "text-accent" : ""}`}>{i + 1}</span>
                <span className="hidden sm:inline">{s.label}</span>
                {step === s.key && (
                  <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </nav>

        {step !== "design" && (
          <button
            className={`btn h-8 px-2.5 ${chatOpen ? "" : "btn-ghost"}`}
            onClick={() => setChatOpen((o) => !o)}
            aria-label="Design assistant"
            aria-expanded={chatOpen}
          >
            <MessageSquare size={15} />
            <span className="hidden lg:inline">Assistant</span>
          </button>
        )}
        {product.techPack && (
          <Link href={`/products/${id}/print`} target="_blank" className="btn h-8 px-2.5">
            <Download size={15} />
            <span className="hidden lg:inline">Tech pack PDF</span>
          </Link>
        )}
      </header>

      {step === "design" && (
        <DesignStep product={product} onUpdate={setProduct} initialBrief={brief} goNext={() => setStep("specs")} />
      )}
      {step === "specs" && <SpecsStep product={product} onUpdate={setProduct} goNext={() => setStep("handoff")} />}
      {step === "handoff" && <HandoffStep product={product} onUpdate={setProduct} openSpecs={openSpecs} />}

      {chatOpen && step !== "design" && (
        <div
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-line bg-card shadow-elev-lg"
          role="dialog"
          aria-label="Design assistant"
        >
          <button className="btn btn-ghost absolute right-2 top-2 z-10 h-8 w-8 p-0" aria-label="Close chat" onClick={() => setChatOpen(false)}>
            <X size={16} />
          </button>
          <ChatPanel product={product} onUpdate={setProduct} className="h-full" />
        </div>
      )}
    </div>
  );
}
