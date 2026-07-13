import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { propertyDocuments, documentCategories } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/properties/validations";
import {
  getPropertyDetail,
  logDownload,
} from "@/lib/properties/queries";
import { buildPropertyR2Key } from "@/lib/properties/utils";
import { uploadToR2, getR2SignedUrl } from "@/lib/storage/r2";
import {
  getPropertyLocationCompleteness,
  PDF_ONLY_DOCUMENT_CATEGORIES,
  parseOwnerInputFromFormData,
  upsertPrimaryPropertyOwner,
} from "@/lib/properties/document-requirements";
import { ownerInputSchema } from "@/lib/properties/validations";
import {
  authorizePropertyDocumentRead,
  authorizePropertyDocumentWrite,
  canViewDocumentAudit,
} from "@/lib/properties/document-auth";
import {
  listPropertyDocumentAuditHistory,
  writePropertyDocumentAudit,
} from "@/lib/properties/document-audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const auth = await authorizePropertyDocumentRead(
    session.user.id,
    session.user.role,
    id,
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await getPropertyDetail(id);
  if (!data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("audit") === "1") {
    if (!canViewDocumentAudit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const history = await listPropertyDocumentAuditHistory(id);
    return NextResponse.json({ history });
  }

  const downloadId = request.nextUrl.searchParams.get("download");
  const previewId = request.nextUrl.searchParams.get("preview");
  const targetId = downloadId ?? previewId;

  if (targetId) {
    const [doc] = await db
      .select()
      .from(propertyDocuments)
      .where(
        and(
          eq(propertyDocuments.id, targetId),
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
      action: previewId ? "preview" : "download",
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });

    return NextResponse.json({
      url,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    });
  }

  return NextResponse.json({ documents: data.documents });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const writeAuth = await authorizePropertyDocumentWrite(
    session.user.id,
    session.user.role,
    id,
  );
  if (!writeAuth.ok) {
    return NextResponse.json(
      { error: writeAuth.error },
      { status: writeAuth.status },
    );
  }

  const property = await getPropertyDetail(id);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const categorySlug = formData.get("categorySlug") as string | null;
  const replaceDocumentId = formData.get("replaceDocumentId") as string | null;

  if (!file || !categorySlug) {
    return NextResponse.json(
      { error: "file and categorySlug are required" },
      { status: 400 },
    );
  }

  const ownerInput = parseOwnerInputFromFormData(formData);
  if (!ownerInput) {
    return NextResponse.json(
      {
        error:
          "Property owner details are required. Submit the owner's full name with the document upload.",
      },
      { status: 400 },
    );
  }

  const ownerParsed = ownerInputSchema.safeParse({
    ...ownerInput,
    sharePercentage: ownerInput.sharePercentage ?? 100,
  });
  if (!ownerParsed.success) {
    const firstIssue = ownerParsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue
          ? `Owner ${firstIssue.path.join(".") || "details"}: ${firstIssue.message}`
          : "Invalid owner details",
        details: ownerParsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const isPdfOnly = PDF_ONLY_DOCUMENT_CATEGORIES.has(categorySlug);
  if (isPdfOnly) {
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          error:
            "Only PDF files are accepted for Registration Deed and Mutation Certificate",
        },
        { status: 400 },
      );
    }

    const completeness = await getPropertyLocationCompleteness(id);
    if (!completeness.complete) {
      return NextResponse.json(
        {
          error: `Complete property location before uploading: ${completeness.missing.join(", ")}`,
          missing: completeness.missing,
        },
        { status: 400 },
      );
    }
  } else if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
  }

  await upsertPrimaryPropertyOwner(
    property.property.parcelId,
    ownerParsed.data,
  );

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

  let previousFileName: string | undefined;
  if (replaceDocumentId || isPdfOnly) {
    const softDeleteConditions = [
      eq(propertyDocuments.propertyId, id),
      eq(propertyDocuments.categoryId, category.id),
      isNull(propertyDocuments.deletedAt),
    ];
    if (replaceDocumentId) {
      softDeleteConditions.push(eq(propertyDocuments.id, replaceDocumentId));
    }

    const existing = await db
      .select({ id: propertyDocuments.id, fileName: propertyDocuments.fileName })
      .from(propertyDocuments)
      .where(and(...softDeleteConditions));

    previousFileName = existing[0]?.fileName;

    if (existing.length > 0) {
      await db
        .update(propertyDocuments)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(
          and(
            eq(propertyDocuments.propertyId, id),
            eq(propertyDocuments.categoryId, category.id),
            isNull(propertyDocuments.deletedAt),
            ...(replaceDocumentId
              ? [eq(propertyDocuments.id, replaceDocumentId)]
              : []),
          ),
        );
    }
  }

  const [latestVersion] = await db
    .select({ version: propertyDocuments.version })
    .from(propertyDocuments)
    .where(
      and(
        eq(propertyDocuments.propertyId, id),
        eq(propertyDocuments.categoryId, category.id),
      ),
    )
    .orderBy(desc(propertyDocuments.version))
    .limit(1);

  const version = (latestVersion?.version ?? 0) + 1;
  const isUpdate = Boolean(replaceDocumentId || previousFileName);

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
      updatedBy: session.user.id,
    })
    .returning();

  await writePropertyDocumentAudit({
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: isUpdate ? "update" : "create",
    documentId: doc.id,
    propertyId: id,
    fileName: file.name,
    categorySlug,
    previousFileName,
    replacedDocumentId: replaceDocumentId,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const writeAuth = await authorizePropertyDocumentWrite(
    session.user.id,
    session.user.role,
    id,
  );
  if (!writeAuth.ok) {
    return NextResponse.json(
      { error: writeAuth.error },
      { status: writeAuth.status },
    );
  }

  const body = (await request.json()) as {
    documentId?: string;
    fileName?: string;
  };

  if (!body.documentId || !body.fileName?.trim()) {
    return NextResponse.json(
      { error: "documentId and fileName are required" },
      { status: 400 },
    );
  }

  const [doc] = await db
    .select()
    .from(propertyDocuments)
    .where(
      and(
        eq(propertyDocuments.id, body.documentId),
        eq(propertyDocuments.propertyId, id),
        isNull(propertyDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const previousFileName = doc.fileName;
  const [updated] = await db
    .update(propertyDocuments)
    .set({
      fileName: body.fileName.trim(),
      updatedAt: new Date(),
      updatedBy: session.user.id,
    })
    .where(eq(propertyDocuments.id, doc.id))
    .returning();

  const [category] = doc.categoryId
    ? await db
        .select({ slug: documentCategories.slug })
        .from(documentCategories)
        .where(eq(documentCategories.id, doc.categoryId))
        .limit(1)
    : [null];

  await writePropertyDocumentAudit({
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: "update",
    documentId: doc.id,
    propertyId: id,
    fileName: updated.fileName,
    categorySlug: category?.slug,
    previousFileName,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({ document: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const writeAuth = await authorizePropertyDocumentWrite(
    session.user.id,
    session.user.role,
    id,
  );
  if (!writeAuth.ok) {
    return NextResponse.json(
      { error: writeAuth.error },
      { status: writeAuth.status },
    );
  }

  const documentId = request.nextUrl.searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId query parameter is required" },
      { status: 400 },
    );
  }

  const [doc] = await db
    .select()
    .from(propertyDocuments)
    .where(
      and(
        eq(propertyDocuments.id, documentId),
        eq(propertyDocuments.propertyId, id),
        isNull(propertyDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await db
    .update(propertyDocuments)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: session.user.id,
    })
    .where(eq(propertyDocuments.id, documentId));

  const [category] = doc.categoryId
    ? await db
        .select({ slug: documentCategories.slug })
        .from(documentCategories)
        .where(eq(documentCategories.id, doc.categoryId))
        .limit(1)
    : [null];

  await writePropertyDocumentAudit({
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: "delete",
    documentId,
    propertyId: id,
    fileName: doc.fileName,
    categorySlug: category?.slug,
    previousFileName: doc.fileName,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({
    success: true,
    message: "Document deleted. Property and GIS mapping were preserved.",
  });
}
