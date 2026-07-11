import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "fs";
import { Readable } from "stream";
import { getMapById } from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import { join } from "path";
import { getUploadPaths } from "@/lib/gis-maps/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const map = await getMapById(id);
  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  const filePath = join(
    getUploadPaths(id).original,
    map.originalFileName,
  );

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Original file not found" }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${map.originalFileName}"`,
    },
  });
}
