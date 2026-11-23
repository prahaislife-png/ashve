"use client";

import { useEffect, useState } from "react";
import { Units, unitsOf } from "./locale";

/**
 * Regional display settings from Brand DNA (units, currency, factory language),
 * shared by every component on the page. Changing units here saves it to Brand DNA.
 */
export type Prefs = { units: Units; currency: string; factoryLanguage: string; vendorCountry: string };

const DEFAULTS: Prefs = { units: "cm", currency: "INR", factoryLanguage: "en", vendorCountry: "India" };
const EVENT = "prefs:changed";
let cache: Prefs | null = null;
let loading: Promise<Prefs> | null = null;

function load(): Promise<Prefs> {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch("/api/brand", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((b: Partial<Record<keyof Prefs, string>>) => {
      cache = {
        units: unitsOf(b.units),
        currency: b.currency || DEFAULTS.currency,
        factoryLanguage: b.factoryLanguage || DEFAULTS.factoryLanguage,
        vendorCountry: b.vendorCountry || DEFAULTS.vendorCountry,
      };
      return cache;
    })
    .catch(() => DEFAULTS);
  return loading;
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(cache ?? DEFAULTS);
  useEffect(() => {
    let alive = true;
    load().then((p) => alive && setPrefs(p));
    const on = (e: Event) => setPrefs((e as CustomEvent<Prefs>).detail);
    window.addEventListener(EVENT, on);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, on);
    };
  }, []);

  function update(change: Partial<Prefs>) {
    const next = { ...(cache ?? prefs), ...change };
    cache = next;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    fetch("/api/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    }).catch(() => {});
  }

  return { ...prefs, setUnits: (units: Units) => update({ units }) };
}
