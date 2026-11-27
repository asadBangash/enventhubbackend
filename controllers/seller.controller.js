const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { toSellerProfile } = require("../utils/serializers");

const getProfile = asyncHandler(async (req, res) => {
  if (!req.user.sellerProfile) throw new AppError("Seller profile not found.", 404);
  sendSuccess(res, toSellerProfile(req.user));
});

const updateProfile = asyncHandler(async (req, res) => {
  if (!req.user.sellerProfile) throw new AppError("Seller profile not found.", 404);

  // phone lives in the User table, everything else in SellerProfile
  const { phone, ...profileData } = req.body;
   
    if (profileData.primaryCategoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: profileData.primaryCategoryId } });
    if (!category || category.type !== "service") {
      throw new AppError("Invalid service category.", 400);
    }
  }
  
  await prisma.$transaction([
    prisma.sellerProfile.update({
      where: { userId: req.user.id },
      data: profileData,
    }),
    ...(phone !== undefined
      ? [prisma.user.update({ where: { id: req.user.id }, data: { phone } })]
      : []),
  ]);

  const updated = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { sellerProfile: true },
  });

  sendSuccess(res, toSellerProfile(updated), "Profile updated successfully.");
});

module.exports = { getProfile, updateProfile };