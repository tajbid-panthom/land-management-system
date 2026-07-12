import type { Role } from "@/lib/auth/rbac";
import { isPropertyOwner } from "@/lib/auth/rbac";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import {
  userOwnsProperty,
  userOwnsVerifiedProperty,
} from "@/lib/properties/queries";

export type DocumentAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string };

/** Staff admins who may view document audit history for any property. */
export function canViewDocumentAudit(role: Role): boolean {
  return ["super_admin", "land_officer", "legal_officer"].includes(role);
}

export function documentActorRoleLabel(role: Role): "Admin" | "Property Owner" {
  return isPropertyOwner(role) ? "Property Owner" : "Admin";
}

/**
 * Read access: admins for any property; owners only for properties they own.
 */
export async function authorizePropertyDocumentRead(
  userId: string,
  role: Role,
  propertyId: string,
): Promise<DocumentAuthResult> {
  if (!canPerformPropertyAction(role, "view_details")) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (isPropertyOwner(role)) {
    if (!(await userOwnsProperty(userId, propertyId))) {
      return {
        ok: false,
        status: 403,
        error: "You can only access documents for properties you own",
      };
    }
  }

  return { ok: true };
}

/**
 * Write access (upload / replace / delete / metadata):
 * - Admins: any property
 * - Property owners: only verified ownership of that property
 */
export async function authorizePropertyDocumentWrite(
  userId: string,
  role: Role,
  propertyId: string,
): Promise<DocumentAuthResult> {
  if (!canPerformPropertyAction(role, "upload_documents")) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (isPropertyOwner(role)) {
    const owns = await userOwnsVerifiedProperty(userId, propertyId);
    if (!owns) {
      return {
        ok: false,
        status: 403,
        error:
          "Only the verified owner of this property may upload or manage its documents",
      };
    }
  }

  return { ok: true };
}
