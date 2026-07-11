import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function AuditLogsPage() {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityTable: auditLogs.entityTable,
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      ipAddress: auditLogs.ipAddress,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div>
      <PageHeader title="Audit Logs" description="System activity trail" />
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => (
              <tr key={log.id} className="border-t border-sky-100">
                <td className="px-4 py-3">
                  {log.createdAt?.toLocaleString()}
                </td>
                <td className="px-4 py-3">{log.actorName}</td>
                <td className="px-4 py-3">{log.action}</td>
                <td className="px-4 py-3">
                  {log.entityTable} / {log.entityId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">{log.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
