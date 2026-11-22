"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

/** Ends the session and goes back to the login page. */
export default function LogoutButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/login", { method: "DELETE" });
        } finally {
          window.location.href = "/login";
        }
      }}
    >
      <LogOut size={compact ? 14 : 15} />
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
