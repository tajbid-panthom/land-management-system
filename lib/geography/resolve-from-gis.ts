import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { districts, divisions, mouzas, upazilas } from "@/lib/db/schema";

export type GisGeographyInput = {
  district?: string | null;
  upazila?: string | null;
  mouza?: string | null;
  jlNumber?: string | null;
  mCode?: string | null;
  /** When true, create missing upazila/mouza rows under the resolved district. */
  ensure?: boolean;
};

export type ResolvedGeography = {
  divisionId: string | null;
  divisionName: string | null;
  districtId: string | null;
  districtName: string | null;
  upazilaId: string | null;
  upazilaName: string | null;
  unionId: string | null;
  mouzaId: string | null;
  mouzaName: string | null;
  jlNumber: string | null;
  ensured: {
    upazila: boolean;
    mouza: boolean;
  };
};

function cleanName(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const lower = text.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower === "district" ||
    lower === "upazila" ||
    lower === "thana" ||
    lower === "mouza" ||
    lower === "mauza" ||
    /^\d{4}-\d{2,4}$/.test(text)
  ) {
    return null;
  }
  return text;
}

function normalizeJl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function slugCode(prefix: string, name: string, max = 20): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${slug || "X"}${suffix}`.slice(0, max);
}

async function findDistrict(name: string) {
  const [row] = await db
    .select({
      id: districts.id,
      name: districts.name,
      divisionId: districts.divisionId,
      divisionName: divisions.name,
    })
    .from(districts)
    .innerJoin(divisions, eq(districts.divisionId, divisions.id))
    .where(ilike(districts.name, name))
    .limit(1);
  return row ?? null;
}

async function findUpazila(name: string, districtId?: string | null) {
  const conditions = [ilike(upazilas.name, name)];
  if (districtId) conditions.push(eq(upazilas.districtId, districtId));
  const [row] = await db
    .select({
      id: upazilas.id,
      name: upazilas.name,
      districtId: upazilas.districtId,
    })
    .from(upazilas)
    .where(and(...conditions))
    .limit(1);
  return row ?? null;
}

async function ensureUpazila(
  name: string,
  districtId: string,
): Promise<{ id: string; name: string; created: boolean }> {
  const existing = await findUpazila(name, districtId);
  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }

  // Prefer an exact district-scoped create; avoid attaching to wrong-district namesakes.
  const [created] = await db
    .insert(upazilas)
    .values({
      districtId,
      name,
      code: slugCode("UPZ-", name),
    })
    .returning({ id: upazilas.id, name: upazilas.name });

  return { id: created.id, name: created.name, created: true };
}

async function findMouza(input: {
  name: string;
  upazilaId?: string | null;
  jlNumber?: string | null;
  mCode?: string | null;
}) {
  if (input.mCode) {
    const byCode = await db
      .select({
        id: mouzas.id,
        name: mouzas.name,
        jlNumber: mouzas.jlNumber,
        upazilaId: mouzas.upazilaId,
        unionId: mouzas.unionId,
      })
      .from(mouzas)
      .where(
        and(
          eq(mouzas.mCode, input.mCode),
          input.upazilaId
            ? or(eq(mouzas.upazilaId, input.upazilaId), isNull(mouzas.upazilaId))
            : sql`true`,
        ),
      )
      .limit(1);
    if (byCode[0]) return byCode[0];
  }

  const nameConditions = [ilike(mouzas.name, input.name)];
  if (input.upazilaId) {
    // Prefer same upazila, but also allow orphan mouzas (null upazila_id).
    const [preferred] = await db
      .select({
        id: mouzas.id,
        name: mouzas.name,
        jlNumber: mouzas.jlNumber,
        upazilaId: mouzas.upazilaId,
        unionId: mouzas.unionId,
      })
      .from(mouzas)
      .where(and(...nameConditions, eq(mouzas.upazilaId, input.upazilaId)))
      .limit(1);
    if (preferred) return preferred;

    const [orphan] = await db
      .select({
        id: mouzas.id,
        name: mouzas.name,
        jlNumber: mouzas.jlNumber,
        upazilaId: mouzas.upazilaId,
        unionId: mouzas.unionId,
      })
      .from(mouzas)
      .where(and(...nameConditions, isNull(mouzas.upazilaId)))
      .limit(1);
    if (orphan) return orphan;
  }

  const [any] = await db
    .select({
      id: mouzas.id,
      name: mouzas.name,
      jlNumber: mouzas.jlNumber,
      upazilaId: mouzas.upazilaId,
      unionId: mouzas.unionId,
    })
    .from(mouzas)
    .where(and(...nameConditions))
    .limit(1);
  return any ?? null;
}

async function ensureMouza(input: {
  name: string;
  upazilaId: string;
  jlNumber?: string | null;
  mCode?: string | null;
}): Promise<{
  id: string;
  name: string;
  jlNumber: string;
  unionId: string | null;
  created: boolean;
}> {
  const existing = await findMouza(input);
  const jlNumber =
    normalizeJl(input.jlNumber) ??
    normalizeJl(existing?.jlNumber) ??
    "N/A";

  if (existing) {
    const needsLink =
      !existing.upazilaId ||
      existing.upazilaId !== input.upazilaId ||
      (input.mCode && !existing.jlNumber);
    if (needsLink || (input.mCode && existing.jlNumber !== jlNumber)) {
      await db
        .update(mouzas)
        .set({
          upazilaId: input.upazilaId,
          jlNumber: existing.jlNumber || jlNumber,
          mCode: input.mCode ?? undefined,
          name: input.name,
        })
        .where(eq(mouzas.id, existing.id));
    }
    return {
      id: existing.id,
      name: existing.name || input.name,
      jlNumber: existing.jlNumber || jlNumber,
      unionId: existing.unionId,
      created: false,
    };
  }

  const [created] = await db
    .insert(mouzas)
    .values({
      name: input.name,
      jlNumber,
      mCode: input.mCode ?? undefined,
      upazilaId: input.upazilaId,
    })
    .returning({
      id: mouzas.id,
      name: mouzas.name,
      jlNumber: mouzas.jlNumber,
      unionId: mouzas.unionId,
    });

  return {
    id: created.id,
    name: created.name,
    jlNumber: created.jlNumber,
    unionId: created.unionId,
    created: true,
  };
}

/**
 * Resolve GIS attribute names to geography UUIDs.
 * With `ensure: true`, missing Dhaka-city thanas/mouzas are created so
 * Create Property from Plot works for all khas-land features — not only
 * the few rows already seeded (e.g. Uttar Meradia / Gulshan).
 */
export async function resolveGeographyFromGisNames(
  input: GisGeographyInput,
): Promise<ResolvedGeography> {
  const districtName = cleanName(input.district);
  const upazilaName = cleanName(input.upazila);
  const mouzaName = cleanName(input.mouza);
  const jlNumber = normalizeJl(input.jlNumber);
  const mCode = cleanName(input.mCode);
  const ensure = Boolean(input.ensure);

  const result: ResolvedGeography = {
    divisionId: null,
    divisionName: null,
    districtId: null,
    districtName: null,
    upazilaId: null,
    upazilaName: null,
    unionId: null,
    mouzaId: null,
    mouzaName: null,
    jlNumber,
    ensured: { upazila: false, mouza: false },
  };

  if (districtName) {
    const district = await findDistrict(districtName);
    if (district) {
      result.districtId = district.id;
      result.districtName = district.name;
      result.divisionId = district.divisionId;
      result.divisionName = district.divisionName;
    }
  }

  // Khas-land GIS layers are Dhaka-centric; when M_District is missing/garbage
  // but we still need to ensure thanas/mouzas, default to Dhaka.
  if (ensure && !result.districtId && (upazilaName || mouzaName)) {
    const dhaka = await findDistrict("Dhaka");
    if (dhaka) {
      result.districtId = dhaka.id;
      result.districtName = dhaka.name;
      result.divisionId = dhaka.divisionId;
      result.divisionName = dhaka.divisionName;
    }
  }

  if (upazilaName) {
    let upazila = await findUpazila(upazilaName, result.districtId);
    if (!upazila && !result.districtId) {
      upazila = await findUpazila(upazilaName);
    }

    if (!upazila && ensure && result.districtId) {
      const created = await ensureUpazila(upazilaName, result.districtId);
      result.upazilaId = created.id;
      result.upazilaName = created.name;
      result.ensured.upazila = created.created;
    } else if (upazila) {
      result.upazilaId = upazila.id;
      result.upazilaName = upazila.name;
      if (!result.districtId) {
        result.districtId = upazila.districtId;
        const [district] = await db
          .select({
            id: districts.id,
            name: districts.name,
            divisionId: districts.divisionId,
            divisionName: divisions.name,
          })
          .from(districts)
          .innerJoin(divisions, eq(districts.divisionId, divisions.id))
          .where(eq(districts.id, upazila.districtId))
          .limit(1);
        if (district) {
          result.districtName = district.name;
          result.divisionId = district.divisionId;
          result.divisionName = district.divisionName;
        }
      }
    }
  }

  if (mouzaName) {
    if (ensure && result.upazilaId) {
      const mouza = await ensureMouza({
        name: mouzaName,
        upazilaId: result.upazilaId,
        jlNumber,
        mCode,
      });
      result.mouzaId = mouza.id;
      result.mouzaName = mouza.name;
      result.unionId = mouza.unionId;
      result.jlNumber = jlNumber || mouza.jlNumber;
      result.ensured.mouza = mouza.created;
    } else {
      const mouza = await findMouza({
        name: mouzaName,
        upazilaId: result.upazilaId,
        jlNumber,
        mCode,
      });
      if (mouza) {
        result.mouzaId = mouza.id;
        result.mouzaName = mouza.name;
        result.unionId = mouza.unionId;
        result.jlNumber = jlNumber || mouza.jlNumber;

        if (!result.upazilaId && mouza.upazilaId) {
          result.upazilaId = mouza.upazilaId;
          const [upazila] = await db
            .select({
              id: upazilas.id,
              name: upazilas.name,
              districtId: upazilas.districtId,
            })
            .from(upazilas)
            .where(eq(upazilas.id, mouza.upazilaId))
            .limit(1);
          if (upazila) {
            result.upazilaName = upazila.name;
            if (!result.districtId) {
              result.districtId = upazila.districtId;
              const [district] = await db
                .select({
                  id: districts.id,
                  name: districts.name,
                  divisionId: districts.divisionId,
                  divisionName: divisions.name,
                })
                .from(districts)
                .innerJoin(divisions, eq(districts.divisionId, divisions.id))
                .where(eq(districts.id, upazila.districtId))
                .limit(1);
              if (district) {
                result.districtName = district.name;
                result.divisionId = district.divisionId;
                result.divisionName = district.divisionName;
              }
            }
          }
        }
      }
    }
  }

  return result;
}
