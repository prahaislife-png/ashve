"use client";

import { useState } from "react";
import { Product } from "./schema";

/** Small helper for buttons that call an API route and get the updated product back. */
export function useAction(onUpdate: (p: Product) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(url: string, method: string, body?: object, label = "Working…") {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return false;
      }
      onUpdate(data as Product);
      return true;
    } catch {
      setError("Couldn't reach the app server.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return { run, busy, error, setError };
}

/** Shrink a photo in the browser so uploads stay small (longest side `max` px, JPEG). */
export async function resizePhoto(file: File, max = 1568): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Read a file as-is (keeps PNG transparency for prints and labels). */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
