import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organisationId: string;
      organisationSlug: string;
      role: string;
      permissions: string[];
    } & DefaultSession["user"];
    /** Set while a super admin is impersonating another user — holds the super admin's own user id. */
    impersonatorId?: string | null;
  }

  interface User {
    organisationId: string;
    organisationSlug: string;
    role: string;
    permissions: string[];
  }
}

// next-auth/jwt re-exports JWT from @auth/core/jwt via `export *`, which does
// not merge with a `declare module "next-auth/jwt"` augmentation — augment
// the defining module directly.
declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    organisationId: string;
    organisationSlug: string;
    role: string;
    permissions: string[];
    impersonatorId?: string | null;
  }
}
