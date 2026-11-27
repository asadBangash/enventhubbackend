const { z } = require("zod");

// Verification documents live in a private folder that is never served publicly
const verificationPath = z
  .string()
  .regex(/^\/uploads\/verification\/[A-Za-z0-9._-]+$/, "Invalid document path.");

const submitVerificationSchema = z.object({
  documentType: z.string().trim().max(60).optional(), // for example CNIC or BUSINESS_REGISTRATION
  documentUrl: verificationPath.optional(),
  note: z.string().trim().max(1000).optional(),
});

module.exports = { submitVerificationSchema };