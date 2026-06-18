import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthed = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");

  if (!isAuthed && !isAuthPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Exclude API routes, Next internals, and any request for a static file
  // (anything with a file extension — logos, icons, manifest, sw.js, etc.)
  // rather than hand-maintaining an allowlist that silently goes stale.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
