const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");

module.exports = asyncHandler(async (req, res, next) => {
  const id = parseId(req.params.id, "Service not found.");
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing || listing.sellerId !== req.user.id || listing.status === "ARCHIVED") {
    throw new AppError("Service not found.", 404);
  }

  req.listing = listing;
  next();
});