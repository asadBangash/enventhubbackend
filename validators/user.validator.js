const { z } = require("zod");
const { uploadPath, strongPassword } = require("./common");

const updateMeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100).optional(),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(20).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  organizationName: z.string().trim().max(120).nullable().optional(),
  avatarUrl: uploadPath.nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: strongPassword,
});

module.exports = { updateMeSchema, changePasswordSchema };