// Shared by middleware (edge) and the login route: no Node-only imports here.

export const AUTH_COOKIE = "tps_session";

/** The cookie value for the current APP_PASSWORD (changing the password logs everyone out). */
export async function sessionToken(password: string) {
  const data = new TextEncoder().encode(`tech-pack-studio:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare for two hex strings. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
