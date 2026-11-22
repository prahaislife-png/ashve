import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

/**
 * Password gate. Set APP_PASSWORD to require a login.
 * Online (on Vercel) the app refuses to run without one, so nobody can use the API keys.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (!password) {
    if (!process.env.VERCEL) return NextResponse.next(); // local computer: open
    const msg = "This app is locked. Set APP_PASSWORD in the Vercel project settings and redeploy.";
    return isApi
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Not behind the password:
  // - Workflow's internal endpoints (.well-known/workflow), or background jobs stall
  // - factory links (/f/<token> and /api/share/<token>/...), which are protected by their secret token
  matcher: ["/((?!login|api/login|api/share/|f/|_next/static|_next/image|favicon.ico|\\.well-known/workflow/).*)"],
};
