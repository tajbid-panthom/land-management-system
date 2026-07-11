/** @deprecated Use shapefile-service.ts */
export {
  parseLegacyShapefileUpload as parseGisUpload,
  geometryToWkt,
  toFeatureCollection as geoJsonToFeatureCollection,
  type ParsedFeature,
  type ShapefileParseResult,
  type LegacyUploadFiles as UploadFileSet,
} from "./shapefile-service";
