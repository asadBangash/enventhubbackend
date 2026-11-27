const { z } = require("zod");

const createDisputeSchema = z.object({
  bookingId: z.coerce.number().int().positive("Booking is required."),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the problem in at least 10 characters.")
    .max(3000),
});

module.exports = { createDisputeSchema };