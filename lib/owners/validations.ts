import { z } from "zod";

const nidSchema = z
  .string()
  .regex(/^\d{10}$|^\d{13}$|^\d{17}$/, "NID must be 10, 13, or 17 digits");

const phoneSchema = z
  .string()
  .regex(/^(\+880|0)1[3-9]\d{8}$/, "Invalid Bangladesh mobile number");

const emailSchema = z.string().email("Invalid email address");

const optionalString = z
  .string()
  .transform((value) => (value.trim() === "" ? undefined : value.trim()));

export const ownerTypeSchema = z.enum(["individual", "organization"]);

export const createOwnerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(150),
  fatherOrHusbandName: optionalString.pipe(z.string().max(150).optional()),
  motherName: optionalString.pipe(z.string().max(150).optional()),
  dateOfBirth: optionalString.pipe(z.string().date().optional()),
  nid: optionalString.pipe(nidSchema.optional()),
  phone: optionalString.pipe(phoneSchema.optional()),
  email: optionalString.pipe(emailSchema.optional()),
  address: optionalString.pipe(z.string().max(300).optional()),
  ownerType: ownerTypeSchema.optional().default("individual"),
});

export const updateOwnerSchema = createOwnerSchema.partial().extend({
  fullName: z.string().min(1).max(150).optional(),
});
