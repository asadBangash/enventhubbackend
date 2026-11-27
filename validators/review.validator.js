const { z } = require("zod");

const createReviewSchema = z.object({
  bookingId: z.coerce.number().int().positive("Booking is required."),
  rating: z.coerce.number().int().min(1, "Rating must be 1 to 5.").max(5, "Rating must be 1 to 5."),
  comment: z.string().trim().max(2000).optional(),
});

module.exports = { createReviewSchema };