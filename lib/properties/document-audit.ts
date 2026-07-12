import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, propertyLocations, users } from "@/lib/db/schema";
import { writeAuditLog } from "@/lib/audit/log";
import type { Role } from "@/lib/auth/rbac";
import { documentActorRoleLabel } from "@/lib/properties/document-auth";
import { getPropertyLocationCompleteness } from "@/lib/properties/document-requirements";

export type DocumentAuditAction = "create" | "update" | "delete";

export async function writePropertyDocumentAudit(input: {
  actorUserId: string;
  actorRole: Role;
  action: DocumentAuditAction;
  documentId: string;
  propertyId: string;
  fileName?: string;
  categorySlug?: string;
  previousFileName?: string;
  replacedDocumentId?: string | null;
  ipAddress?: string;
}) {
  const completeness = await getPropertyLocationCompleteness(input.propertyId);
  const location = completeness.location;

  let mouzaName: string | null = null;
  if (location?.mouzaId) {
    const [loc] = await db
      .select({ mouzaName: propertyLocations.mouzaName })
      .from(propertyLocations)
      .where(eq(propertyLocations.propertyId, input.propertyId))
      .limit(1);
    mouzaName = loc?.mouzaName ?? null;
  }

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityTable: "property_documents",
    entityId: input.documentId,
    previousValue: input.previousFileName
      ? { fileName: input.previousFileName }
      : null,
    newValue: {
      actionPerformed: input.action,
      uploadedBy: input.actorUserId,
      userRole: documentActorRoleLabel(input.actorRole),
      role: input.actorRole,
      propertyId: input.propertyId,
      plotNumber: location?.plotNumber ?? null,
      mouzaId: location?.mouzaId ?? null,
      mouza: mouzaName,
      jlNumber: location?.jlNumber ?? null,
      fileName: input.fileName ?? null,
      category: input.categorySlug ?? null,
      replacedDocumentId: input.replacedDocumentId ?? null,
    },
    ipAddress: input.ipAddress,
  });
}

export type DocumentAuditHistoryItem = {
  id: string;
  action: string;
  actionPerformed: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedByEmail: string | null;
  userRole: string | null;
  propertyId: string | null;
  plotNumber: string | null;
  mouzaId: string | null;
  mouza: string | null;
  jlNumber: string | null;
  fileName: string | null;
  category: string | null;
  createdAt: Date | null;
};

export async function listPropertyDocumentAuditHistory(
  propertyId: string,
  limit = 100,
): Promise<DocumentAuditHistoryItem[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      newValue: auditLogs.newValue,
      previousValue: auditLogs.previousValue,
      actorUserId: auditLogs.actorUserId,
      actorName: users.name,
      actorEmail: users.email,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(eq(auditLogs.entityTable, "property_documents"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit * 3);

  return rows
    .filter((row) => {
      const value = row.newValue as Record<string, unknown> | null;
      return value?.propertyId === propertyId;
    })
    .slice(0, limit)
    .map((row) => {
      const value = (row.newValue ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        action: row.action,
        actionPerformed: String(value.actionPerformed ?? row.action),
        uploadedBy: row.actorUserId,
        uploadedByName: row.actorName,
        uploadedByEmail: row.actorEmail,
        userRole: value.userRole != null ? String(value.userRole) : null,
        propertyId:
          value.propertyId != null ? String(value.propertyId) : propertyId,
        plotNumber:
          value.plotNumber != null ? String(value.plotNumber) : null,
        mouzaId: value.mouzaId != null ? String(value.mouzaId) : null,
        mouza: value.mouza != null ? String(value.mouza) : null,
        jlNumber: value.jlNumber != null ? String(value.jlNumber) : null,
        fileName: value.fileName != null ? String(value.fileName) : null,
        category: value.category != null ? String(value.category) : null,
        createdAt: row.createdAt,
      };
    });
}

/** Derive last-updated actor from the newest update/create audit entry for a document. */
export async function getDocumentLastUpdate(
  documentId: string,
): Promise<{ updatedBy: string | null; updatedAt: Date | null } | null> {
  const [row] = await db
    .select({
      actorUserId: auditLogs.actorUserId,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityTable, "property_documents"),
        eq(auditLogs.entityId, documentId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!row) return null;
  return { updatedBy: row.actorUserId, updatedAt: row.createdAt };
}
