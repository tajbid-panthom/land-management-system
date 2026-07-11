import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPropertyAdmin } from "@/lib/auth/rbac";
import {
  getDatasetActivityLogs,
  getDatasetById,
} from "@/lib/mouza-gis/queries";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id || !isPropertyAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const datasetId = request.nextUrl.searchParams.get("datasetId");
  if (!datasetId) {
    return NextResponse.json({ error: "datasetId is required" }, { status: 400 });
  }

  const dataset = await getDatasetById(datasetId);
  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const logs = await getDatasetActivityLogs(datasetId);
  return NextResponse.json({ logs });
}
