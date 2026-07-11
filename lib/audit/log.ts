import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "verify"
  | "download"
  | "transition";

interface AuditEntry {
  actorUserId: string;
  action: AuditAction;
  entityTable: string;
  entityId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
}

export async function writeAuditLog(entry: AuditEntry) {
  await db.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityTable: entry.entityTable,
    entityId: entry.entityId,
    previousValue: entry.previousValue ?? null,
    newValue: entry.newValue ?? null,
    ipAddress: entry.ipAddress,
  });
}
