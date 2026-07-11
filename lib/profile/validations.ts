import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(150).optional(),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .optional(),
  })
  .refine(
    (data) => !data.newPassword || data.currentPassword,
    {
      message: "Current password is required to set a new password",
      path: ["currentPassword"],
    },
  );
