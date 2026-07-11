export * from "./geometry";
export * from "./geography";
export * from "./parcels";
export * from "./ownership";
export * from "./legal";
export * from "./landuse";
export * from "./documents";
export * from "./services";
export * from "./auth";
export * from "./properties";
export * from "./mouza-gis";
export * from "./gis-maps";

import { relations } from "drizzle-orm";
import { divisions, districts, upazilas, unions, mouzas } from "./geography";
import { landParcels, khatians } from "./parcels";
import { owners, ownershipRecords, inheritanceRecords } from "./ownership";
import {
  deeds,
  mutationCases,
  powerOfAttorney,
  courtCases,
} from "./legal";
import { landUse } from "./landuse";
import { documents } from "./documents";
import {
  landAcquisition,
  mortgages,
  landTransactions,
} from "./services";
import { users, auditLogs, reportJobs } from "./auth";
import {
  mouzaGisDatasets,
  mouzaGisImports,
  mouzaGisRecords,
  mouzaDbfFiles,
  mouzaGisFeatures,
} from "./mouza-gis";
import {
  gisMaps,
  gisLayers,
  gisLayerFeatures,
  gisProcessingJobs,
} from "./gis-maps";
import {
  properties,
  propertyLocations,
  propertyDeeds,
  propertyDeedVersions,
  ownershipHistory,
  coOwners,
  inheritanceInformation,
  planningInformation,
  propertyDocuments,
  documentCategories,
  downloadLogs,
  propertyReports,
  userOwnerLinks,
} from "./properties";

export const divisionsRelations = relations(divisions, ({ many }) => ({
  districts: many(districts),
}));

export const districtsRelations = relations(districts, ({ one, many }) => ({
  division: one(divisions, {
    fields: [districts.divisionId],
    references: [divisions.id],
  }),
  upazilas: many(upazilas),
}));

export const upazilasRelations = relations(upazilas, ({ one, many }) => ({
  district: one(districts, {
    fields: [upazilas.districtId],
    references: [districts.id],
  }),
  unions: many(unions),
}));

export const unionsRelations = relations(unions, ({ one, many }) => ({
  upazila: one(upazilas, {
    fields: [unions.upazilaId],
    references: [upazilas.id],
  }),
  mouzas: many(mouzas),
}));

export const mouzasRelations = relations(mouzas, ({ one, many }) => ({
  union: one(unions, {
    fields: [mouzas.unionId],
    references: [unions.id],
  }),
  upazila: one(upazilas, {
    fields: [mouzas.upazilaId],
    references: [upazilas.id],
  }),
  parcels: many(landParcels),
}));

export const landParcelsRelations = relations(landParcels, ({ one, many }) => ({
  mouza: one(mouzas, {
    fields: [landParcels.mouzaId],
    references: [mouzas.id],
  }),
  khatians: many(khatians),
  ownershipRecords: many(ownershipRecords),
  deeds: many(deeds),
  mutationCases: many(mutationCases),
  courtCases: many(courtCases),
  landUse: many(landUse),
  documents: many(documents),
}));

export const khatiansRelations = relations(khatians, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [khatians.parcelId],
    references: [landParcels.id],
  }),
}));

export const ownersRelations = relations(owners, ({ many }) => ({
  ownershipRecords: many(ownershipRecords),
}));

export const ownershipRecordsRelations = relations(
  ownershipRecords,
  ({ one }) => ({
    parcel: one(landParcels, {
      fields: [ownershipRecords.parcelId],
      references: [landParcels.id],
    }),
    owner: one(owners, {
      fields: [ownershipRecords.ownerId],
      references: [owners.id],
    }),
  }),
);

export const inheritanceRecordsRelations = relations(
  inheritanceRecords,
  ({ one }) => ({
    deceasedOwner: one(owners, {
      fields: [inheritanceRecords.deceasedOwnerId],
      references: [owners.id],
    }),
    heirOwner: one(owners, {
      fields: [inheritanceRecords.heirOwnerId],
      references: [owners.id],
    }),
    parcel: one(landParcels, {
      fields: [inheritanceRecords.parcelId],
      references: [landParcels.id],
    }),
  }),
);

export const deedsRelations = relations(deeds, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [deeds.parcelId],
    references: [landParcels.id],
  }),
}));

export const mutationCasesRelations = relations(mutationCases, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [mutationCases.parcelId],
    references: [landParcels.id],
  }),
}));

export const powerOfAttorneyRelations = relations(powerOfAttorney, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [powerOfAttorney.parcelId],
    references: [landParcels.id],
  }),
}));

export const courtCasesRelations = relations(courtCases, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [courtCases.parcelId],
    references: [landParcels.id],
  }),
}));

export const landUseRelations = relations(landUse, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [landUse.parcelId],
    references: [landParcels.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [documents.parcelId],
    references: [landParcels.id],
  }),
}));

export const landAcquisitionRelations = relations(landAcquisition, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [landAcquisition.parcelId],
    references: [landParcels.id],
  }),
}));

export const mortgagesRelations = relations(mortgages, ({ one }) => ({
  parcel: one(landParcels, {
    fields: [mortgages.parcelId],
    references: [landParcels.id],
  }),
}));

export const landTransactionsRelations = relations(
  landTransactions,
  ({ one }) => ({
    parcel: one(landParcels, {
      fields: [landTransactions.parcelId],
      references: [landParcels.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
  reportJobs: many(reportJobs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const reportJobsRelations = relations(reportJobs, ({ one }) => ({
  requester: one(users, {
    fields: [reportJobs.requestedBy],
    references: [users.id],
  }),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  parcel: one(landParcels, {
    fields: [properties.parcelId],
    references: [landParcels.id],
  }),
  location: one(propertyLocations, {
    fields: [properties.id],
    references: [propertyLocations.propertyId],
  }),
  deed: one(propertyDeeds, {
    fields: [properties.id],
    references: [propertyDeeds.propertyId],
  }),
  planning: one(planningInformation, {
    fields: [properties.id],
    references: [planningInformation.propertyId],
  }),
  inheritance: one(inheritanceInformation, {
    fields: [properties.id],
    references: [inheritanceInformation.propertyId],
  }),
  ownershipHistory: many(ownershipHistory),
  coOwners: many(coOwners),
  documents: many(propertyDocuments),
  reports: many(propertyReports),
  creator: one(users, {
    fields: [properties.createdBy],
    references: [users.id],
  }),
}));

export const propertyLocationsRelations = relations(
  propertyLocations,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyLocations.propertyId],
      references: [properties.id],
    }),
    mouza: one(mouzas, {
      fields: [propertyLocations.mouzaId],
      references: [mouzas.id],
    }),
  }),
);

export const propertyDeedsRelations = relations(
  propertyDeeds,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [propertyDeeds.propertyId],
      references: [properties.id],
    }),
    versions: many(propertyDeedVersions),
  }),
);

export const propertyDocumentsRelations = relations(
  propertyDocuments,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyDocuments.propertyId],
      references: [properties.id],
    }),
    category: one(documentCategories, {
      fields: [propertyDocuments.categoryId],
      references: [documentCategories.id],
    }),
    uploader: one(users, {
      fields: [propertyDocuments.uploadedBy],
      references: [users.id],
    }),
  }),
);

export const userOwnerLinksRelations = relations(userOwnerLinks, ({ one }) => ({
  user: one(users, {
    fields: [userOwnerLinks.userId],
    references: [users.id],
  }),
  owner: one(owners, {
    fields: [userOwnerLinks.ownerId],
    references: [owners.id],
  }),
}));

export const mouzaGisDatasetsRelations = relations(
  mouzaGisDatasets,
  ({ one, many }) => ({
    district: one(districts, {
      fields: [mouzaGisDatasets.districtId],
      references: [districts.id],
    }),
    imports: many(mouzaGisImports),
    records: many(mouzaGisRecords),
    dbfFiles: many(mouzaDbfFiles),
    features: many(mouzaGisFeatures),
  }),
);

export const mouzaGisRecordsRelations = relations(
  mouzaGisRecords,
  ({ one }) => ({
    dataset: one(mouzaGisDatasets, {
      fields: [mouzaGisRecords.datasetId],
      references: [mouzaGisDatasets.id],
    }),
    mouza: one(mouzas, {
      fields: [mouzaGisRecords.mouzaId],
      references: [mouzas.id],
    }),
    parcel: one(landParcels, {
      fields: [mouzaGisRecords.parcelId],
      references: [landParcels.id],
    }),
  }),
);

export const gisMapsRelations = relations(gisMaps, ({ one, many }) => ({
  uploader: one(users, {
    fields: [gisMaps.uploadedBy],
    references: [users.id],
  }),
  layers: many(gisLayers),
  jobs: many(gisProcessingJobs),
}));

export const gisLayersRelations = relations(gisLayers, ({ one, many }) => ({
  map: one(gisMaps, {
    fields: [gisLayers.mapId],
    references: [gisMaps.id],
  }),
  features: many(gisLayerFeatures),
}));

export const gisLayerFeaturesRelations = relations(
  gisLayerFeatures,
  ({ one }) => ({
    layer: one(gisLayers, {
      fields: [gisLayerFeatures.layerId],
      references: [gisLayers.id],
    }),
  }),
);

export const gisProcessingJobsRelations = relations(
  gisProcessingJobs,
  ({ one }) => ({
    map: one(gisMaps, {
      fields: [gisProcessingJobs.mapId],
      references: [gisMaps.id],
    }),
  }),
);
