import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type CloudinaryUploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  bytes: number;
  format: string;
};

export async function uploadToCloudinary(
  file: Buffer | string,
  options: {
    folder: string;
    publicId?: string;
    resourceType?: "image" | "raw" | "auto";
  },
): Promise<CloudinaryUploadResult> {
  const result = await cloudinary.uploader.upload(
    typeof file === "string" ? file : `data:application/octet-stream;base64,${file.toString("base64")}`,
    {
      folder: options.folder,
      public_id: options.publicId,
      resource_type: options.resourceType ?? "auto",
      overwrite: false,
    },
  );

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    bytes: result.bytes,
    format: result.format,
  };
}

export function getCloudinaryUrl(
  publicId: string,
  transforms?: string,
): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const transform = transforms ? `${transforms}/` : "";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}${publicId}`;
}

export { cloudinary };
