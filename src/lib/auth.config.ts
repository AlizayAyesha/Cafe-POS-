import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import { normalizeRole } from "@/lib/permissions";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      if (pathname.startsWith("/pos") || pathname.startsWith("/admin")) {
        return isLoggedIn;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = normalizeRole((user as { role: Role }).role) ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (normalizeRole(token.role as string) ??
          "CASHIER") as Role;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
