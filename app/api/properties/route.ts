import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canPerformPropertyAction } from "@/lib/auth/property-permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  createPropertySchema,
  propertyFilterSchema,
} from "@/lib/properties/validations";
import {
  createPropertyWithParcel,
  listProperties,
  getOwnerPropertyIds,
} from "@/lib/properties/queries";
import { isPropertyOwner } from "@/lib/auth/rbac";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = propertyFilterSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid filters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let result = await listProperties(parsed.data);

  if (isPropertyOwner(session.user.role)) {
    const ownedIds = await getOwnerPropertyIds(session.user.id);
    result = {
      ...result,
      items: result.items.filter((item) => ownedIds.includes(item.id)),
      total: result.items.filter((item) => ownedIds.includes(item.id)).length,
    };
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !canPerformPropertyAction(session.user.role, "create")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const property = await createPropertyWithParcel(
    {
      status: parsed.data.status,
      location: parsed.data.location,
      deed: parsed.data.deed,
      owner: parsed.data.owner,
    },
    session.user.id,
  );

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "create",
    entityTable: "properties",
    entityId: property.id,
    newValue: property as unknown as Record<string, unknown>,
    ipAddress: clientIp(request),
  });

  return NextResponse.json({ property }, { status: 201 });
}
