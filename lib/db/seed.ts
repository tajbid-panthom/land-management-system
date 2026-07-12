import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDivisions, getDistricts, getUpazilas, getUnions } from "bd-geo-info";
import { db } from "./index";
import {
  divisions,
  districts,
  upazilas,
  unions,
  mouzas,
  landParcels,
  khatians,
  users,
  owners,
  ownershipRecords,
  properties,
  propertyLocations,
  propertyDeeds,
  propertyDeedVersions,
  planningInformation,
  inheritanceInformation,
  documentCategories,
  userOwnerLinks,
} from "./schema";
import {
  buildQrPayload,
  convertAreaToAllUnits,
  generatePropertyCode,
} from "../properties/utils";

async function seed() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  await db
    .insert(users)
    .values([
      {
        email: "admin@land.gov.bd",
        name: "System Admin",
        passwordHash,
        role: "super_admin",
      },
      {
        email: "officer@land.gov.bd",
        name: "Land Officer",
        passwordHash,
        role: "land_officer",
      },
      {
        email: "approver@land.gov.bd",
        name: "Approver",
        passwordHash,
        role: "approver",
      },
      {
        email: "verifier@land.gov.bd",
        name: "Field Verifier",
        passwordHash,
        role: "field_verifier",
      },
      {
        email: "owner@land.gov.bd",
        name: "Property Owner",
        passwordHash,
        role: "property_owner",
      },
    ])
    .onConflictDoNothing();

  const divisionList = await getDivisions("en");
  const divisionNamesBn = new Map(
    (await getDivisions("bn")).map((division) => [division.value, division.label]),
  );

  let divisionCount = 0;
  let districtCount = 0;
  let upazilaCount = 0;
  let unionCount = 0;

  for (const division of divisionList) {
    const divisionCode = `DIV-${division.value}`;
    const [existingDivision] = await db
      .select()
      .from(divisions)
      .where(eq(divisions.code, divisionCode))
      .limit(1);

    const divisionRow =
      existingDivision ??
      (
        await db
          .insert(divisions)
          .values({
            name: division.label,
            nameBn: divisionNamesBn.get(division.value) ?? null,
            code: divisionCode,
          })
          .returning()
      )[0];

    if (!existingDivision) divisionCount += 1;

    const divisionDistrictsEn = await getDistricts(division.value, "en");
    const divisionDistrictsBn = new Map(
      (await getDistricts(division.value, "bn")).map((district) => [
        district.value,
        district.label,
      ]),
    );

    for (const districtItem of divisionDistrictsEn) {
      const districtCode = `DIST-${districtItem.value}`;
      const [existingDistrict] = await db
        .select()
        .from(districts)
        .where(eq(districts.code, districtCode))
        .limit(1);

      let district = existingDistrict;

      if (!district) {
        district = (
          await db
            .insert(districts)
            .values({
              divisionId: divisionRow.id,
              name: districtItem.label,
              nameBn: divisionDistrictsBn.get(districtItem.value) ?? null,
              code: districtCode,
            })
            .returning()
        )[0];
        districtCount += 1;
      } else if (!district.divisionId) {
        await db
          .update(districts)
          .set({
            divisionId: divisionRow.id,
            nameBn: district.nameBn ?? divisionDistrictsBn.get(districtItem.value) ?? null,
          })
          .where(eq(districts.id, district.id));
      }

      const districtUpazilasEn = await getUpazilas(districtItem.value, "en");
      const districtUpazilasBn = new Map(
        (await getUpazilas(districtItem.value, "bn")).map((upazila) => [
          upazila.value,
          upazila.label,
        ]),
      );

      for (const upazilaItem of districtUpazilasEn) {
        const upazilaCode = `UPZ-${upazilaItem.value}`;
        const [existingUpazila] = await db
          .select()
          .from(upazilas)
          .where(eq(upazilas.code, upazilaCode))
          .limit(1);

        const upazila =
          existingUpazila ??
          (
            await db
              .insert(upazilas)
              .values({
                districtId: district.id,
                name: upazilaItem.label,
                nameBn: districtUpazilasBn.get(upazilaItem.value) ?? null,
                code: upazilaCode,
              })
              .returning()
          )[0];

        if (!existingUpazila) upazilaCount += 1;

        const upazilaUnionsEn = await getUnions(upazilaItem.value, "en");
        const upazilaUnionsBn = new Map(
          (await getUnions(upazilaItem.value, "bn")).map((union) => [
            union.value,
            union.label,
          ]),
        );

        for (const unionItem of upazilaUnionsEn) {
          const unionCode = `UNI-${unionItem.value}`;
          const [existingUnion] = await db
            .select()
            .from(unions)
            .where(eq(unions.code, unionCode))
            .limit(1);

          if (!existingUnion) {
            await db.insert(unions).values({
              upazilaId: upazila.id,
              name: unionItem.label,
              type: "union",
              code: unionCode,
            });
            unionCount += 1;
          }

          // Keep the Bangla name map loaded so IDs stay aligned if the schema grows later.
          upazilaUnionsBn.get(unionItem.value);
        }
      }
    }
  }

  const [dhakaDistrict] = await db
    .select()
    .from(districts)
    .where(eq(districts.name, "Dhaka"))
    .limit(1);

  if (!dhakaDistrict) {
    throw new Error("Dhaka district was not seeded");
  }

  const [savarUpazila] = await db
    .select()
    .from(upazilas)
    .where(
      and(eq(upazilas.districtId, dhakaDistrict.id), eq(upazilas.name, "Savar")),
    )
    .limit(1);

  if (!savarUpazila) {
    throw new Error("Savar upazila was not seeded");
  }

  const [ashuliaUnion] = await db
    .select()
    .from(unions)
    .where(
      and(eq(unions.upazilaId, savarUpazila.id), eq(unions.name, "Ashulia")),
    )
    .limit(1);

  if (!ashuliaUnion) {
    throw new Error("Ashulia union was not seeded");
  }

  const [existingMouza] = await db
    .select()
    .from(mouzas)
    .where(eq(mouzas.jlNumber, "JL-1042"))
    .limit(1);

  const mouza =
    existingMouza ??
    (
      await db
        .insert(mouzas)
        .values({
          unionId: ashuliaUnion.id,
          upazilaId: savarUpazila.id,
          name: "Baipail",
          nameBn: "বাইপাইল",
          jlNumber: "JL-1042",
        })
        .returning()
    )[0];

  // Dhaka → Gulshan (Upazila/Thana) → Uttar Meradia (Mouza)
  const [existingGulshan] = await db
    .select()
    .from(upazilas)
    .where(
      and(
        eq(upazilas.districtId, dhakaDistrict.id),
        eq(upazilas.name, "Gulshan"),
      ),
    )
    .limit(1);

  const gulshanUpazila =
    existingGulshan ??
    (
      await db
        .insert(upazilas)
        .values({
          districtId: dhakaDistrict.id,
          name: "Gulshan",
          nameBn: "গুলশান",
          code: "UPZ-DHK-GULSHAN",
        })
        .returning()
    )[0];

  const [existingMeradiaUnion] = await db
    .select()
    .from(unions)
    .where(
      and(
        eq(unions.upazilaId, gulshanUpazila.id),
        eq(unions.name, "Meradia"),
      ),
    )
    .limit(1);

  const meradiaUnion =
    existingMeradiaUnion ??
    (
      await db
        .insert(unions)
        .values({
          upazilaId: gulshanUpazila.id,
          name: "Meradia",
          type: "union",
          code: "UNI-DHK-GUL-MERADIA",
        })
        .returning()
    )[0];

  const [existingUttarMeradia] = await db
    .select()
    .from(mouzas)
    .where(
      and(
        eq(mouzas.name, "Uttar Meradia"),
        eq(mouzas.jlNumber, "JL-2785"),
      ),
    )
    .limit(1);

  if (!existingUttarMeradia) {
    await db.insert(mouzas).values({
      unionId: meradiaUnion.id,
      upazilaId: gulshanUpazila.id,
      name: "Uttar Meradia",
      nameBn: "উত্তর মেড়াদিয়া",
      jlNumber: "JL-2785",
      mCode: "UTTAR-MERADIA",
    });
  }

  const [existingParcel] = await db
    .select()
    .from(landParcels)
    .where(
      and(eq(landParcels.mouzaId, mouza.id), eq(landParcels.plotNumber, "125")),
    )
    .limit(1);

  const parcel =
    existingParcel ??
    (
      await db
        .insert(landParcels)
        .values({
          mouzaId: mouza.id,
          plotNumber: "125",
          areaValue: "3.5000",
          areaUnit: "decimal",
          status: "active",
        })
        .returning()
    )[0];

  const existingKhatians = await db
    .select()
    .from(khatians)
    .where(eq(khatians.parcelId, parcel.id));

  if (existingKhatians.length === 0) {
    await db.insert(khatians).values([
      {
        parcelId: parcel.id,
        khatianType: "RS",
        khatianNumber: "RS-4521",
      },
      {
        parcelId: parcel.id,
        khatianType: "CS",
        khatianNumber: "CS-1102",
      },
    ]);
  }

  const [existingOwner] = await db
    .select()
    .from(owners)
    .where(eq(owners.phone, "01700000001"))
    .limit(1);

  const owner =
    existingOwner ??
    (
      await db
        .insert(owners)
        .values({
          fullName: "Abdul Karim",
          fatherOrHusbandName: "Abdul Hamid",
          phone: "01700000001",
          address: "Baipail, Savar, Dhaka",
          ownerType: "individual",
        })
        .returning()
    )[0];

  const [existingOwnership] = await db
    .select()
    .from(ownershipRecords)
    .where(
      and(
        eq(ownershipRecords.parcelId, parcel.id),
        eq(ownershipRecords.ownerId, owner.id),
        eq(ownershipRecords.isCurrent, true),
      ),
    )
    .limit(1);

  if (!existingOwnership) {
    await db.insert(ownershipRecords).values({
      parcelId: parcel.id,
      ownerId: owner.id,
      sharePercentage: "100.00",
      acquisitionMethod: "purchase",
      effectiveFrom: "2015-06-01",
      isCurrent: true,
      verificationStatus: "pending",
    });
  }

  const categories = [
    { slug: "deed_copy", name: "Registration Deed" },
    { slug: "khatian_copy", name: "Khatian Copy" },
    { slug: "survey_map", name: "Survey Map" },
    { slug: "mutation_certificate", name: "Mutation / Namjari Certificate" },
    { slug: "court_documents", name: "Court Documents" },
    { slug: "power_of_attorney", name: "Power of Attorney" },
    { slug: "gis_files", name: "GIS Files" },
    { slug: "other", name: "Other Documents" },
  ];
  for (const cat of categories) {
    const [existing] = await db
      .select()
      .from(documentCategories)
      .where(eq(documentCategories.slug, cat.slug))
      .limit(1);
    if (!existing) {
      await db.insert(documentCategories).values(cat);
    } else if (existing.name !== cat.name) {
      await db
        .update(documentCategories)
        .set({ name: cat.name })
        .where(eq(documentCategories.id, existing.id));
    }
  }

  const [existingProperty] = await db
    .select()
    .from(properties)
    .where(eq(properties.parcelId, parcel.id))
    .limit(1);

  if (!existingProperty) {
    const propertyCode = generatePropertyCode(1);
    const areas = convertAreaToAllUnits(3.5, "decimal");

    const [property] = await db
      .insert(properties)
      .values({
        parcelId: parcel.id,
        propertyCode,
        qrCodePayload: buildQrPayload(propertyCode),
        status: "active",
      })
      .returning();

    await db.insert(propertyLocations).values({
      propertyId: property.id,
      districtId: dhakaDistrict.id,
      upazilaId: savarUpazila.id,
      unionId: ashuliaUnion.id,
      mouzaId: mouza.id,
      mouzaName: mouza.name,
      jlNumber: mouza.jlNumber,
      plotNumber: parcel.plotNumber,
      khatianCs: "CS-1102",
      khatianRs: "RS-4521",
      areaDecimal: areas.decimal,
      areaAcre: areas.acre,
      areaHectare: areas.hectare,
      areaSqft: areas.sqft,
    });

    const [deed] = await db
      .insert(propertyDeeds)
      .values({
        propertyId: property.id,
        deedNumber: "DEED-2015-88421",
        registrationDate: "2015-06-15",
        namjariStatus: "pending",
        litigationStatus: "none",
      })
      .returning();

    await db.insert(propertyDeedVersions).values({
      propertyDeedId: deed.id,
      version: 1,
      deedNumber: deed.deedNumber,
      registrationDate: deed.registrationDate,
      namjariStatus: deed.namjariStatus,
      litigationStatus: deed.litigationStatus,
    });

    await db.insert(planningInformation).values({
      propertyId: property.id,
      existingLandUse: "agricultural",
      proposedLandUse: "residential",
    });

    await db.insert(inheritanceInformation).values({
      propertyId: property.id,
      isApplicable: false,
    });
  }

  const [ownerUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "owner@land.gov.bd"))
    .limit(1);

  if (ownerUser) {
    const [existingLink] = await db
      .select()
      .from(userOwnerLinks)
      .where(
        and(
          eq(userOwnerLinks.userId, ownerUser.id),
          eq(userOwnerLinks.ownerId, owner.id),
        ),
      )
      .limit(1);

    if (!existingLink) {
      await db.insert(userOwnerLinks).values({
        userId: ownerUser.id,
        ownerId: owner.id,
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  Divisions inserted this run: ${divisionCount}`);
  console.log(`  Districts inserted this run: ${districtCount}`);
  console.log(`  Upazilas inserted this run: ${upazilaCount}`);
  console.log(`  Unions inserted this run: ${unionCount}`);
  console.log("  Demo parcel: Dhaka → Savar → Ashulia → Baipail (JL-1042)");
  console.log("  Parcel: Plot 125 (3.5 decimal)");
  console.log("  Users: admin@land.gov.bd / admin123 (and officer, approver, verifier, owner)");
  console.log("  Property: PROP-* linked to demo parcel");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
