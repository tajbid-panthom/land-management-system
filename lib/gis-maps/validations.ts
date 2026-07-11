import { z } from "zod";

export const gisUploadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const gisLayerStyleSchema = z.object({
  visible: z.boolean().optional(),
  styleJson: z.record(z.string(), z.unknown()).optional(),
  opacity: z.number().min(0).max(1).optional(),
  lineWidth: z.number().min(0.5).max(20).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const gisSearchSchema = z.object({
  q: z.string().min(1).max(200),
  mapId: z.string().uuid().optional(),
  layer: z.string().max(100).optional(),
});
