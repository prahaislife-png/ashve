import { NextResponse } from "next/server";
import { AUTH_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });

  const { password: given } = (await req.json().catch(() => ({}))) as { password?: string };
  const [expected, attempt] = await Promise.all([sessionToken(password), sessionToken(String(given ?? ""))]);
  if (!safeEqual(expected, attempt)) {
    // small delay to slow down guessing
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  return res;
}

/** Log out: expire the session cookie with the same settings it was created with. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
