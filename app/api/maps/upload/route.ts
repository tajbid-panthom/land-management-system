import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { gisMaps, gisProcessingJobs } from "@/lib/db/schema";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import {
  saveOriginalFile,
  slugifyMapName,
  getFileSize,
} from "@/lib/gis-maps/storage";
import { startMapProcessing } from "@/lib/gis-maps/process-runner";
import { SUPPORTED_GIS_FORMATS } from "@/lib/gis-maps/constants";
import { writeAuditLog } from "@/lib/audit/log";

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const nameInput = (formData.get("name") as string | null)?.trim();

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = getExtension(file.name);
  if (!(SUPPORTED_GIS_FORMATS as readonly string[]).includes(ext)) {
    return NextResponse.json(
      {
        error: `Unsupported format .${ext}. Supported: ${SUPPORTED_GIS_FORMATS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const mapId = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());
  const displayName = nameInput || file.name.replace(/\.[^.]+$/, "");
  const slug = `${slugifyMapName(displayName)}-${mapId.slice(0, 8)}`;

  const { safeName, filePath } = await saveOriginalFile(
    mapId,
    file.name,
    buffer,
  );
  const fileSize = await getFileSize(filePath);

  const [map] = await db
    .insert(gisMaps)
    .values({
      id: mapId,
      name: displayName,
      slug,
      originalFile: filePath,
      originalFileName: safeName,
      fileSizeBytes: fileSize,
      fileFormat: ext,
      status: "uploading",
      uploadedBy: auth.session.user.id,
      processingLog: [],
    })
    .returning();

  const [job] = await db
    .insert(gisProcessingJobs)
    .values({
      mapId,
      status: "queued",
      progress: 0,
      message: "Upload received",
    })
    .returning();

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "create",
    entityTable: "gis_maps",
    entityId: mapId,
    newValue: { name: displayName, fileName: safeName },
  });

  // Background processing — do not await
  void startMapProcessing(mapId, job.id);

  return NextResponse.json({
    mapId: map.id,
    jobId: job.id,
    status: "queued",
    message: "Upload received. Processing started.",
  });
}
