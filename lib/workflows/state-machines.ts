import type { mutationStatusEnum } from "@/lib/db/schema/legal";
import type { verificationStatusEnum } from "@/lib/db/schema/ownership";
import type { Role } from "@/lib/auth/rbac";
import {
  canApplyMutation,
  canApproveMutation,
  canVerifyOwnership,
  canApproveOwnership,
} from "@/lib/auth/rbac";

type MutationStatus = (typeof mutationStatusEnum.enumValues)[number];
type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];

const MUTATION_TRANSITIONS: Record<
  MutationStatus,
  { next: MutationStatus[]; requiredRole: (role: Role) => boolean }
> = {
  not_applied: {
    next: ["applied"],
    requiredRole: canApplyMutation,
  },
  applied: {
    next: ["under_hearing"],
    requiredRole: canApplyMutation,
  },
  under_hearing: {
    next: ["approved", "rejected"],
    requiredRole: canApproveMutation,
  },
  approved: { next: [], requiredRole: () => false },
  rejected: { next: [], requiredRole: () => false },
};

const VERIFICATION_TRANSITIONS: Record<
  VerificationStatus,
  { next: VerificationStatus[]; requiredRole: (role: Role) => boolean }
> = {
  pending: {
    next: ["under_review"],
    requiredRole: canVerifyOwnership,
  },
  under_review: {
    next: ["verified", "rejected", "disputed"],
    requiredRole: canApproveOwnership,
  },
  verified: { next: [], requiredRole: () => false },
  rejected: { next: [], requiredRole: () => false },
  disputed: { next: ["under_review"],
    requiredRole: canApproveOwnership,
  },
};

export function canTransitionMutation(
  role: Role,
  current: MutationStatus,
  next: MutationStatus,
): boolean {
  const rule = MUTATION_TRANSITIONS[current];
  return rule.requiredRole(role) && rule.next.includes(next);
}

export function canTransitionVerification(
  role: Role,
  current: VerificationStatus,
  next: VerificationStatus,
): boolean {
  const rule = VERIFICATION_TRANSITIONS[current];
  return rule.requiredRole(role) && rule.next.includes(next);
}

export function getAvailableVerificationTransitions(
  role: Role,
  current: VerificationStatus,
): VerificationStatus[] {
  const rule = VERIFICATION_TRANSITIONS[current];
  if (!rule.requiredRole(role)) return [];
  return rule.next;
}

export function getAvailableMutationTransitions(
  role: Role,
  current: MutationStatus,
): MutationStatus[] {
  const rule = MUTATION_TRANSITIONS[current];
  if (!rule.requiredRole(role)) return [];
  return rule.next;
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
  disputed: "Disputed",
};

export const MUTATION_STATUS_LABELS: Record<MutationStatus, string> = {
  not_applied: "Not applied",
  applied: "Applied",
  under_hearing: "Under hearing",
  approved: "Approved",
  rejected: "Rejected",
};

export function isOwnershipFrozen(status: VerificationStatus): boolean {
  return status === "disputed";
}
