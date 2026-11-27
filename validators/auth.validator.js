const { z } = require("zod");
const { strongPassword } = require("./common");

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  email,
  password: strongPassword,
  role: z.enum(["buyer", "seller"], { message: "Role must be buyer or seller." }),

  // Optional extras (SRS FR-AUTH-02 and FR-AUTH-03)
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(20).optional(),
  city: z.string().trim().max(80).optional(),
  organizationName: z.string().trim().max(120).optional(),
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters.").max(120).optional(),
  contactPerson: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  website: z.string().trim().max(200).optional(),
  serviceAreas: z.string().trim().max(500).optional(),
  primaryCategoryId: z.coerce.number().int().positive().optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string().min(20, "Invalid reset link.").max(200),
  newPassword: strongPassword,
});

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema };