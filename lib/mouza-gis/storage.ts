import { mkdir, writeFile } from "fs/promises";
import { join, relative } from "path";
import {
  uploadToCloudinary,
  type CloudinaryUploadResult,
} from "@/lib/storage/cloudinary";

const UPLOAD_ROOT = join(process.cwd(), "uploads", "mouza-gis");

/** Cloudinary raw uploads are capped at 20 MB. */
export const CLOUDINARY_RAW_MAX_BYTES = 20 * 1024 * 1024;
const CLOUDINARY_SAFE_MAX_BYTES = 19 * 1024 * 1024;

export type StoredFile = CloudinaryUploadResult & {
  storage: "cloudinary" | "local";
};

export function getMouzaGisUploadPaths(datasetId: string) {
  return {
    root: join(UPLOAD_ROOT, datasetId),
    archives: join(UPLOAD_ROOT, datasetId, "archives"),
    geojson: join(UPLOAD_ROOT, datasetId, "geojson"),
  };
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function storeMouzaGisFile(
  buffer: Buffer,
  options: {
    datasetId: string;
    folder: "archives" | "geojson";
    fileName: string;
    publicIdBase: string;
  },
): Promise<StoredFile> {
  if (buffer.byteLength <= CLOUDINARY_SAFE_MAX_BYTES) {
    const uploaded = await uploadToCloudinary(buffer, {
      folder: `mouza-gis/${options.datasetId}/${options.folder}`,
      resourceType: "raw",
      publicId: options.publicIdBase,
    });
    return { ...uploaded, storage: "cloudinary" };
  }

  const paths = getMouzaGisUploadPaths(options.datasetId);
  const targetDir = paths[options.folder];
  await mkdir(targetDir, { recursive: true });

  const filePath = join(targetDir, `${options.publicIdBase}-${safeFileName(options.fileName)}`);
  await writeFile(filePath, buffer);

  const relativePath = relative(process.cwd(), filePath);
  return {
    publicId: `local/${relativePath}`,
    url: relativePath,
    secureUrl: relativePath,
    bytes: buffer.byteLength,
    format: options.fileName.split(".").pop() ?? "bin",
    storage: "local",
  };
}
