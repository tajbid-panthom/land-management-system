import { z } from "zod";
import { ROLES } from "@/lib/auth/rbac";

const roleSchema = z.enum(ROLES);

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  email: z.string().email("Invalid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().max(200).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});
