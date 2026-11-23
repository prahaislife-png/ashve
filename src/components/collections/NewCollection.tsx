"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

/** "New collection" button that opens a small form. */
export default function NewCollection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, season, launchDate }),
    });
    const c = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(c.error ?? "Couldn't create the collection.");
      setBusy(false);
      return;
    }
    router.push(`/collections/${c.id}`);
  }

  if (!open)
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} /> New collection
      </button>
    );

  return (
    <form onSubmit={create} className="card flex w-full flex-wrap items-end gap-3 p-4 sm:w-auto">
      <label className="block min-w-48 flex-1">
        <span className="mb-1 block text-[13px] font-medium">Name</span>
        <input className="input" autoFocus placeholder="e.g. Monsoon Ease" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block w-36">
        <span className="mb-1 block text-[13px] font-medium">Season</span>
        <input className="input" placeholder="e.g. SS27" value={season} onChange={(e) => setSeason(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-medium">Launch</span>
        <input className="input" type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className="w-full text-[13px] text-danger">{error}</p>}
    </form>
  );
}
