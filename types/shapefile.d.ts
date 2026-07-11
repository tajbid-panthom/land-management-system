declare module "shapefile" {
  export interface SourceResult {
    done: boolean;
    value: {
      type: string;
      properties: Record<string, unknown>;
      geometry: import("geojson").Geometry | null;
    };
  }

  export function open(
    shp?: Buffer | ArrayBuffer,
    dbf?: Buffer | ArrayBuffer,
  ): Promise<{
    read(): Promise<SourceResult>;
  }>;
}
