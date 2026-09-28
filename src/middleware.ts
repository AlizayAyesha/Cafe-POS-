import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccessAdmin, normalizeRole } from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = normalizeRole(req.auth?.user?.role);

  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      const dest = canAccessAdmin(role) ? "/admin" : "/pos";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/pos") || pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }
  }

  // Only cashiers are blocked from /admin — Admin & Supervisor allowed
  if (pathname.startsWith("/admin") && role && !canAccessAdmin(role)) {
    return NextResponse.redirect(new URL("/pos", req.url));
  }

  if (pathname === "/") {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const dest = canAccessAdmin(role) ? "/admin" : "/pos";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/login", "/pos/:path*", "/admin/:path*"],
};
