import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  owners,
  ownershipRecords,
  properties,
  userOwnerLinks,
  users,
} from "@/lib/db/schema";

export async function getUserProfile(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const links = await db
    .select({
      id: owners.id,
      fullName: owners.fullName,
      fatherOrHusbandName: owners.fatherOrHusbandName,
      motherName: owners.motherName,
      dateOfBirth: owners.dateOfBirth,
      phone: owners.phone,
      email: owners.email,
      address: owners.address,
      ownerType: owners.ownerType,
      createdAt: owners.createdAt,
    })
    .from(userOwnerLinks)
    .innerJoin(owners, eq(userOwnerLinks.ownerId, owners.id))
    .where(and(eq(userOwnerLinks.userId, userId), isNull(owners.deletedAt)));

  let propertyCount = 0;
  if (links.length > 0) {
    const ownerIds = links.map((link) => link.id);
    const records = await db
      .select({ parcelId: ownershipRecords.parcelId })
      .from(ownershipRecords)
      .where(
        and(
          inArray(ownershipRecords.ownerId, ownerIds),
          eq(ownershipRecords.isCurrent, true),
        ),
      );

    if (records.length > 0) {
      const parcelIds = records.map((record) => record.parcelId);
      const props = await db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            inArray(properties.parcelId, parcelIds),
            isNull(properties.deletedAt),
          ),
        );
      propertyCount = props.length;
    }
  }

  return {
    user,
    linkedOwners: links,
    propertyCount,
  };
}
