const { z } = require("zod");

const createRequestSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
    listingId: z.coerce.number().int().positive().optional(),
    sellerId: z.coerce.number().int().positive().optional(),
    eventId: z.coerce.number().int().positive().optional(),
    eventDate: z.coerce.date().optional(),
    location: z.string().trim().max(200).optional(),
    minBudget: z.coerce.number().positive().optional(),
    maxBudget: z.coerce.number().positive().optional(),
    details: z.string().trim().min(5, "Please describe what you need.").max(3000),
  })
  .refine(
    (d) => d.minBudget === undefined || d.maxBudget === undefined || d.minBudget <= d.maxBudget,
    { message: "Minimum budget cannot be higher than maximum budget.", path: ["maxBudget"] }
  );

const offerSchema = z
  .object({
    amount: z.coerce.number().positive("Price must be greater than 0.").max(1000000000),
    description: z.string().trim().min(5, "Describe what the quote includes.").max(3000),
    validUntil: z.coerce.date().optional(),
  })
  .refine((d) => d.validUntil === undefined || d.validUntil > new Date(), {
    message: "Valid-until date must be in the future.",
    path: ["validUntil"],
  });

module.exports = { createRequestSchema, offerSchema };