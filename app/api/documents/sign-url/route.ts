import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canDownloadConfidential } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/audit/log";
import { getR2SignedUrl } from "@/lib/storage/r2";
import { getCloudinaryUrl } from "@/lib/storage/cloudinary";
import { z } from "zod";

const signUrlSchema = z.object({
  documentId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = signUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, parsed.data.documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (
    doc.sensitivityLevel === "confidential" &&
    !canDownloadConfidential(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let url: string;
  if (doc.storageProvider === "r2") {
    const ttl = doc.documentType === "generated_report" ? 900 : 600;
    url = await getR2SignedUrl(doc.storageKey, ttl);
  } else {
    url = getCloudinaryUrl(doc.storageKey);
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "download",
    entityTable: "documents",
    entityId: doc.id,
    newValue: { documentType: doc.documentType },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ url, expiresIn: doc.storageProvider === "r2" ? 600 : null });
}
