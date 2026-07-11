import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import type { Role } from "./rbac";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  const role = session.user.role;
  if (!allowed.includes(role)) {
    throw new Error("Forbidden");
  }
  return session;
}
