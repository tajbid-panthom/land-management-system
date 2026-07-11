import type { Role } from "./rbac";
import { isPropertyAdmin, isPropertyOwner } from "./rbac";

export type PropertyAction =
  | "create"
  | "edit"
  | "delete"
  | "restore"
  | "upload_documents"
  | "update_deed"
  | "update_ownership"
  | "view_ownership"
  | "view_details"
  | "download_reports"
  | "view_land_planning"
  | "manage_mouza"
  | "bulk_operations";

const PERMISSIONS: Record<PropertyAction, Role[]> = {
  create: ["super_admin", "land_officer", "legal_officer"],
  edit: ["super_admin", "land_officer", "legal_officer"],
  delete: ["super_admin", "land_officer"],
  restore: ["super_admin", "land_officer"],
  upload_documents: ["super_admin", "land_officer", "legal_officer"],
  update_deed: ["super_admin", "land_officer", "legal_officer"],
  update_ownership: ["super_admin", "land_officer", "property_owner"],
  view_ownership: ["super_admin", "land_officer", "legal_officer", "property_owner"],
  view_details: [
    "super_admin",
    "land_officer",
    "legal_officer",
    "approver",
    "field_verifier",
    "bank_viewer",
    "property_owner",
    "public_user",
  ],
  download_reports: [
    "super_admin",
    "land_officer",
    "legal_officer",
    "approver",
    "field_verifier",
    "bank_viewer",
    "property_owner",
    "public_user",
  ],
  view_land_planning: ["super_admin", "land_officer", "legal_officer"],
  manage_mouza: ["super_admin", "land_officer"],
  bulk_operations: ["super_admin", "land_officer"],
};

export function canPerformPropertyAction(
  role: Role,
  action: PropertyAction,
): boolean {
  return PERMISSIONS[action].includes(role);
}

export function canEditPropertySection(
  role: Role,
  section:
    | "mouza"
    | "deed"
    | "ownership"
    | "land_planning"
    | "documents"
    | "profile",
): boolean {
  if (isPropertyAdmin(role)) return true;

  if (isPropertyOwner(role)) {
    return section === "ownership";
  }

  if (section === "profile" || section === "documents") {
    return canPerformPropertyAction(role, "view_details");
  }

  return false;
}
