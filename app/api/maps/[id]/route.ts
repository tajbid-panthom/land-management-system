import { NextResponse } from "next/server";
import {
  getMapById,
  getMapLayers,
  getLatestJobForMap,
} from "@/lib/gis-maps/queries";
import { requireGisAdmin } from "@/lib/gis-maps/permissions";
import { db } from "@/lib/db";
import { gisMaps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteMap } from "@/lib/gis-maps/queries";
import { writeAuditLog } from "@/lib/audit/log";

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

  const layers = await getMapLayers(id);
  const job = await getLatestJobForMap(id);

  return NextResponse.json({ map, layers, job });
}

export async function DELETE(
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

  await deleteMap(id);

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "delete",
    entityTable: "gis_maps",
    entityId: id,
    previousValue: { name: map.name },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireGisAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json()) as { name?: string };

  const [updated] = await db
    .update(gisMaps)
    .set({
      name: body.name,
      updatedAt: new Date(),
    })
    .where(eq(gisMaps.id, id))
    .returning();

  return NextResponse.json({ map: updated });
}
