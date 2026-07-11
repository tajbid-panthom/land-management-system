import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { mapDatasetSchema } from "@/lib/mouza-gis/validations";
import { synchronizeDataset } from "@/lib/mouza-gis/sync-service";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = mapDatasetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await synchronizeDataset(parsed.data.datasetId);

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "update",
      entityTable: "mouza_gis_datasets",
      entityId: parsed.data.datasetId,
      newValue: result as unknown as Record<string, unknown>,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Mapping failed",
      },
      { status: 500 },
    );
  }
}
