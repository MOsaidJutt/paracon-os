import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the Auth.js config: no providers with Node-only deps
 * (bcrypt, Prisma) here. Middleware runs in the Edge runtime and only needs
 * to read the existing session token via the jwt/session callbacks — it
 * never calls signIn, so the Credentials provider's authorize() (which
 * needs bcrypt + Prisma) doesn't belong in this bundle.
 */
export const authConfig: NextAuthConfig = {
  // Without this, Auth.js ignores the actual incoming Host header and
  // rebuilds every redirect/callback URL from NEXTAUTH_URL instead — fine
  // for a fixed production domain, but breaks any tunnel/proxy (ngrok,
  // Docker, etc.) where the public host differs from NEXTAUTH_URL. Safe
  // here since we control the deployment; this is the documented fix for
  // exactly this scenario.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id as string;
        token.organisationId = user.organisationId;
        token.organisationSlug = user.organisationSlug;
        token.role = user.role;
        token.permissions = user.permissions;
      }
      // Fired by lib/auth.ts's `unstable_update` — used to swap the JWT's
      // identity claims for impersonation without a full sign-in/out cycle.
      if (trigger === "update" && session) {
        const data = session as {
          user?: { id: string; organisationId: string; organisationSlug: string; role: string; permissions: string[] };
          impersonatorId?: string | null;
        };
        if (data.user) {
          token.userId = data.user.id;
          token.organisationId = data.user.organisationId;
          token.organisationSlug = data.user.organisationSlug;
          token.role = data.user.role;
          token.permissions = data.user.permissions;
        }
        if ("impersonatorId" in data) {
          token.impersonatorId = data.impersonatorId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.organisationId = token.organisationId;
      session.user.organisationSlug = token.organisationSlug;
      session.user.role = token.role;
      session.user.permissions = token.permissions;
      session.impersonatorId = token.impersonatorId ?? null;
      return session;
    },
  },
};
