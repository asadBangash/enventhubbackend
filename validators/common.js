const { z } = require("zod");

// Only paths created by our own upload folders are accepted
const uploadPath = z
  .string()
  .regex(/^\/uploads\/(avatars|listings|portfolio)\/[A-Za-z0-9._-]+$/, "Invalid image path.");

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.")
  .regex(/[A-Za-z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

module.exports = { uploadPath, strongPassword };