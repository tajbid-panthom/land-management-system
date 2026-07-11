import { customType } from "drizzle-orm/pg-core";

/** PostGIS geometry column — Drizzle has no native type */
export const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Geometry, 4326)";
  },
});

export const polygonGeometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Polygon, 4326)";
  },
});
