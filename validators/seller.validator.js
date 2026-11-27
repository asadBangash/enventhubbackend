const { z } = require("zod");
const { uploadPath } = require("./common");

const updateSellerProfileSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters.").max(120).optional(),
  contactPerson: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(20).optional(),
  location: z.string().trim().max(150).optional(),
  website: z.string().trim().max(200).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  serviceAreas: z.string().trim().max(500).optional(),
  logoUrl: uploadPath.optional(),
  coverUrl: uploadPath.optional(),
    primaryCategoryId: z.coerce.number().int().positive().optional(),
});

const portfolioItemSchema = z.object({
  title: z.string().trim().min(2, "Enter a project title.").max(120),
  description: z.string().trim().max(1000).optional(),
});

// "2027-03-20" must be a real calendar date
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((s) => new Date(s + "T00:00:00.000Z").toISOString().slice(0, 10) === s, "Invalid date.");

const setAvailabilitySchema = z.object({
  dates: z.array(dateString).min(1).max(62),
  state: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});

module.exports = { updateSellerProfileSchema, portfolioItemSchema, setAvailabilitySchema };