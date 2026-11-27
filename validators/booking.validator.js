const { z } = require("zod");

// Seller confirms deal (CONFIRMED), then progresses service; buyer pays after COMPLETED.
const updateBookingStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "IN_PROGRESS", "COMPLETED"], {
    message: "Invalid booking status.",
  }),
  note: z.string().trim().max(1000).optional(),
});

const checkoutPaymentSchema = z.object({
  bookingId: z.coerce.number().int().positive("Booking is required."),
});

const confirmSessionSchema = z.object({
  bookingId: z.coerce.number().int().positive("Booking is required."),
  sessionId: z.string().min(8, "Invalid session."),
});

const createPaymentSchema = z.object({
  bookingId: z.coerce.number().int().positive("Booking is required."),
  idempotencyKey: z.string().min(8, "Invalid payment key.").max(100),
  method: z.enum(["card", "jazzcash", "easypaisa", "bank_transfer", "bank"]).optional(),
});

module.exports = { updateBookingStatusSchema, createPaymentSchema, checkoutPaymentSchema, confirmSessionSchema };