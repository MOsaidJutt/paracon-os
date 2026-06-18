import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the Auth.js config: no providers with Node-only deps
 * (bcrypt, Prisma) here. Middleware runs in the Edge runtime and only needs
 * to read the existing session token via the jwt/session callbacks — it
 * never calls signIn, so the Credentials provider's authorize() (which
 * needs bcrypt + Prisma) doesn't belong in this bundle.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.organisationId = user.organisationId;
        token.organisationSlug = user.organisationSlug;
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.organisationId = token.organisationId;
      session.user.organisationSlug = token.organisationSlug;
      session.user.role = token.role;
      session.user.permissions = token.permissions;
      return session;
    },
  },
};
