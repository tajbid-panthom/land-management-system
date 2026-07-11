export const ROLES = [
  "super_admin",
  "land_officer",
  "field_verifier",
  "approver",
  "bank_viewer",
  "legal_officer",
  "property_owner",
  "public_user",
] as const;

export type Role = (typeof ROLES)[number];

const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 100,
  land_officer: 80,
  approver: 75,
  field_verifier: 70,
  legal_officer: 65,
  bank_viewer: 40,
  property_owner: 30,
  public_user: 10,
};

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canAccessDashboard(role: Role): boolean {
  return hasMinimumRole(role, "bank_viewer");
}

export function canEditParcels(role: Role): boolean {
  return ["super_admin", "land_officer", "legal_officer"].includes(role);
}

export function canApplyMutation(role: Role): boolean {
  return ["super_admin", "land_officer"].includes(role);
}

export function canApproveMutation(role: Role): boolean {
  return ["super_admin", "approver"].includes(role);
}

export function canVerifyOwnership(role: Role): boolean {
  return ["super_admin", "field_verifier"].includes(role);
}

export function canApproveOwnership(role: Role): boolean {
  return ["super_admin", "approver"].includes(role);
}

export function canDownloadConfidential(role: Role): boolean {
  return [
    "super_admin",
    "land_officer",
    "legal_officer",
    "approver",
    "field_verifier",
  ].includes(role);
}

export function canViewMortgages(role: Role): boolean {
  return [
    "super_admin",
    "land_officer",
    "bank_viewer",
    "legal_officer",
  ].includes(role);
}

export function isPropertyAdmin(role: Role): boolean {
  return ["super_admin", "land_officer", "legal_officer", "approver"].includes(
    role,
  );
}

export function isPropertyOwner(role: Role): boolean {
  return role === "property_owner";
}

export function isGeneralUser(role: Role): boolean {
  return ["public_user", "bank_viewer"].includes(role);
}

export function canAccessOwnerPortal(role: Role): boolean {
  return role === "property_owner" || isPropertyAdmin(role);
}

export function canAccessPropertyDashboard(role: Role): boolean {
  return canAccessDashboard(role) || role === "property_owner";
}
