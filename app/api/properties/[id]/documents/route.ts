import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { propertyDocuments, documentCategories } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/properties/validations";
import {
  getPropertyDetail,
  logDownload,
  userOwnsProperty,
} from "@/lib/properties/queries";
import { buildPropertyR2Key } from "@/lib/properties/utils";
import { uploadToR2, getR2SignedUrl } from "@/lib/storage/r2";
import { isPropertyOwner } from "@/lib/auth/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await getPropertyDetail(id);
  if (!data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (
    isPropertyOwner(session.user.role) &&
    !(await userOwnsProperty(session.user.id, id))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const downloadId = request.nextUrl.searchParams.get("download");
  if (downloadId) {
    const [doc] = await db
      .select()
      .from(propertyDocuments)
      .where(
        and(
          eq(propertyDocuments.id, downloadId),
          eq(propertyDocuments.propertyId, id),
          isNull(propertyDocuments.deletedAt),
        ),
      )
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const url = await getR2SignedUrl(doc.storageKey);
    await logDownload({
      propertyId: id,
      documentId: doc.id,
      userId: session.user.id,
      action: "download",
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });

    return NextResponse.json({ url, fileName: doc.fileName });
  }

  return NextResponse.json({ documents: data.documents });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "upload_documents")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const categorySlug = formData.get("categorySlug") as string | null;

  if (!file || !categorySlug) {
    return NextResponse.json(
      { error: "file and categorySlug are required" },
      { status: 400 },
    );
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
  }

  const [category] = await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.slug, categorySlug))
    .limit(1);

  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = buildPropertyR2Key(id, categorySlug, file.name);
  await uploadToR2(storageKey, buffer, file.type);

  const [existingVersion] = await db
    .select()
    .from(propertyDocuments)
    .where(
      and(
        eq(propertyDocuments.propertyId, id),
        eq(propertyDocuments.categoryId, category.id),
        isNull(propertyDocuments.deletedAt),
      ),
    )
    .limit(1);

  const version = (existingVersion?.version ?? 0) + 1;

  const [doc] = await db
    .insert(propertyDocuments)
    .values({
      propertyId: id,
      categoryId: category.id,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      fileSizeBytes: file.size,
      version,
      uploadedBy: session.user.id,
    })
    .returning();

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entityTable: "property_documents",
    entityId: doc.id,
    newValue: { fileName: file.name, category: categorySlug },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
