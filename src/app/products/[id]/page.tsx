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
      <header className="sticky top-0 z-30 flex h-[57px] items-center gap-2 border-b border-line bg-panel/95 px-3 backdrop-blur">
        <Link href="/workspace" className="btn btn-ghost h-8 w-8 p-0" aria-label="Back to workspace">
          <ChevronLeft size={17} />
        </Link>
        <input
          key={product.name}
          className="w-28 min-w-0 truncate bg-transparent text-sm font-medium outline-none sm:w-56"
          defaultValue={product.name}
          aria-label="Product name"
          onBlur={(e) => rename(e.target.value)}
        />
        <div className="relative">
          <button className="btn btn-ghost h-8 w-8 p-0" aria-label="More" onClick={() => setMenu((m) => !m)}>
            <MoreVertical size={16} />
          </button>
          {menu && (
            <div className="card absolute left-0 top-9 z-40 w-44 p-1 shadow-lg">
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

        <nav className="mx-auto flex items-center gap-1 text-sm">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              {i > 0 && <span className="mx-1 hidden h-px w-8 bg-line sm:block" />}
              <button
                onClick={() => setStep(s.key)}
                className={`flex items-center gap-1.5 border-b-2 px-2 py-4 ${
                  step === s.key ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] ${
                    step === s.key ? "bg-ink text-white" : "border border-line"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          ))}
        </nav>

        {step !== "design" && (
          <button className="btn btn-ghost h-8 px-2" onClick={() => setChatOpen((o) => !o)} aria-label="Chat">
            <MessageSquare size={15} />
            <span className="hidden lg:inline">Chat</span>
          </button>
        )}
        {product.techPack && (
          <Link href={`/products/${id}/print`} target="_blank" className="btn h-8 px-2">
            <Download size={15} />
            <span className="hidden lg:inline">Download summary</span>
          </Link>
        )}
      </header>

      {step === "design" && (
        <DesignStep product={product} onUpdate={setProduct} initialBrief={brief} goNext={() => setStep("specs")} />
      )}
      {step === "specs" && <SpecsStep product={product} onUpdate={setProduct} goNext={() => setStep("handoff")} />}
      {step === "handoff" && <HandoffStep product={product} onUpdate={setProduct} openSpecs={openSpecs} />}

      {chatOpen && step !== "design" && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-line bg-panel shadow-2xl">
          <button className="btn btn-ghost absolute right-2 top-2 z-10 h-8 w-8 p-0" aria-label="Close chat" onClick={() => setChatOpen(false)}>
            <X size={16} />
          </button>
          <ChatPanel product={product} onUpdate={setProduct} className="h-full" />
        </div>
      )}
    </div>
  );
}
