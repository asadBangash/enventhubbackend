const { z } = require("zod");

const fields = {
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
  description: z.string().trim().max(5000),
  location: z.string().trim().max(150).nullable(),
  categoryId: z.coerce.number().int().positive("Select a category."),
  price: z.coerce
    .number()
    .positive("Price must be greater than 0.")
    .max(100000000, "Price is too large."),
  pricingType: z.enum(["fixed", "per_person", "per_hour", "per_day"]),
  features: z.string().trim().max(3000).nullable(),
  terms: z.string().trim().max(3000).nullable(),
  // Sellers can only save a draft or submit for review
  status: z.enum(["DRAFT", "PENDING"]),
};

const createListingSchema = z.object({
  title: fields.title,
  categoryId: fields.categoryId,
  price: fields.price,
  description: fields.description.optional(),
  location: fields.location.optional(),
  pricingType: fields.pricingType.optional(),
  features: fields.features.optional(),
  terms: fields.terms.optional(),
  status: fields.status.optional(),
});

const updateListingSchema = z.object(fields).partial();

// Admin decision on a listing
const moderateListingSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    message: "Status must be APPROVED or REJECTED.",
  }),
});

module.exports = { createListingSchema, updateListingSchema, moderateListingSchema };