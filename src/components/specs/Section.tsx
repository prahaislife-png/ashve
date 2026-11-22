export function Section({
  id,
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="h-title text-xl">{title}</h2>
            {badge}
          </div>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="card p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className="tab"
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-panel px-3 py-2">
      <div className="field-label">{label}</div>
      <div className="mt-0.5 text-sm">{value || "—"}</div>
    </div>
  );
}

export function Status({ busy, error }: { busy: string | null; error: string | null }) {
  return (
    <>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          {busy}
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-warn-soft p-2.5 text-sm text-warn-ink">{error}</p>}
    </>
  );
}

export function Swatch({ name, hex, sub }: { name: string; hex: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
      <span className="h-8 w-8 shrink-0 rounded-md border border-line" style={{ background: hex }} />
      <div className="min-w-0 text-sm leading-tight">
        <div className="truncate font-medium">{name}</div>
        <div className="text-xs text-muted">{sub || hex}</div>
      </div>
    </div>
  );
}
