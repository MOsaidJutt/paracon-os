import { auth } from "./auth";
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
 * Loads the current session and asserts it carries the given permission
 * slug. Throws ForbiddenError if missing. Call at the top of every
 * server action / route handler that touches protected data.
 */
export async function requirePermission(slug: string): Promise<Session> {
  const session = await requireSession();
  if (!session.user.permissions.includes(slug)) {
    throw new ForbiddenError(slug);
  }
  return session;
}

export function hasPermission(session: Session, slug: string): boolean {
  return session.user.permissions.includes(slug);
}
