import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

/**
 * Builds the JWT-shaped identity for a user by id — the same fields
 * Credentials.authorize() returns at login. Used by the impersonation
 * routes to swap the session's identity claims via `unstable_update`.
 */
export async function loadUserIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      organisation: true,
    },
  });
  if (!user || !user.isActive || !user.organisation.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organisationId: user.organisationId,
    organisationSlug: user.organisation.slug,
    role: user.role.slug,
    permissions: user.role.rolePermissions.map((rp) => rp.permission.slug),
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), isActive: true },
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
            organisation: true,
          },
        });
        if (!user || !user.organisation.isActive) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          organisationId: user.organisationId,
          organisationSlug: user.organisation.slug,
          role: user.role.slug,
          permissions: user.role.rolePermissions.map((rp) => rp.permission.slug),
        };
      },
    }),
  ],
});
