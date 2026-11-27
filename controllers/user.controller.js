const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { toPublicUser } = require("../utils/serializers");

// GET /api/users/me
const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, toPublicUser(req.user));
});

// PATCH /api/users/me
const updateMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: req.body,
    include: { sellerProfile: true },
  });
  sendSuccess(res, toPublicUser(user), "Profile updated successfully.");
});

// PATCH /api/users/me/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!ok) throw new AppError("Current password is incorrect.", 400);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

  sendSuccess(res, null, "Password changed successfully.");
});

module.exports = { getMe, updateMe, changePassword };