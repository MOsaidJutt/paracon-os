import { auth } from "./auth";
import { prisma } from "./prisma";
import type { Session } from "next-auth";
import { ForbiddenError, UnauthorisedError } from "./errors";

export { ForbiddenError, UnauthorisedError };

/** Loads the current session or throws UnauthorisedError. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthorisedError();
  return session;
}

/**
 * Re-reads the user's role + permissions from the DB by id rather than
 * trusting the JWT-cached `session.user.permissions` snapshot, so a role
 * edit or impersonation takes effect on the very next request instead of
 * requiring sign-out/sign-in.
 */
async function loadFreshPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!user || !user.isActive) throw new UnauthorisedError();
  return user.role.rolePermissions.map((rp) => rp.permission.slug);
}

/**
 * Loads the current session and asserts it carries the given permission
 * slug, checked fresh against the DB. Throws ForbiddenError if missing.
 * Call at the top of every server action / route handler that touches
 * protected data.
 */
export async function requirePermission(slug: string): Promise<Session> {
  const session = await requireSession();
  const permissions = await loadFreshPermissions(session.user.id);
  if (!permissions.includes(slug)) {
    throw new ForbiddenError(slug);
  }
  session.user.permissions = permissions;
  return session;
}

/** Like requirePermission, but passes if the user holds any of the given slugs. */
export async function requireAnyPermission(slugs: string[]): Promise<Session> {
  const session = await requireSession();
  const permissions = await loadFreshPermissions(session.user.id);
  if (!slugs.some((slug) => permissions.includes(slug))) {
    throw new ForbiddenError(slugs.join(" | "));
  }
  session.user.permissions = permissions;
  return session;
}

export function hasPermission(session: Session, slug: string): boolean {
  return session.user.permissions.includes(slug);
}
