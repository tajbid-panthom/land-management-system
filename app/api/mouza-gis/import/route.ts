import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import { importExcelToDataset } from "@/lib/mouza-gis/import-service";
import { getDatasetById } from "@/lib/mouza-gis/queries";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const datasetId = formData.get("datasetId") as string | null;

  if (!file || !datasetId) {
    return NextResponse.json(
      { error: "file and datasetId are required" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
    return NextResponse.json(
      { error: "Invalid file type. Upload .xlsx, .xls, or .csv" },
      { status: 400 },
    );
  }

  const dataset = await getDatasetById(datasetId);
  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importExcelToDataset(
      datasetId,
      buffer,
      file.name,
      session.user.id,
    );

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "create",
      entityTable: "mouza_gis_imports",
      entityId: result.importId,
      newValue: result as unknown as Record<string, unknown>,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Import failed",
      },
      { status: 400 },
    );
  }
}
