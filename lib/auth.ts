import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
