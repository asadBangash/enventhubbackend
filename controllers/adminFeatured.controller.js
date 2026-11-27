const { z } = require("zod");
const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { logAction } = require("../services/audit.service");

const schema = z.object({
  isFeatured: z.boolean({ message: "isFeatured must be true or false." }),
});

// PATCH /api/admin/listings/:id/featured  { isFeatured: true | false }
const setFeatured = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Service not found.");
  const { isFeatured } = schema.parse(req.body);

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status === "ARCHIVED") throw new AppError("Service not found.", 404);
  if (listing.status !== "APPROVED") {
    throw new AppError("Only approved services can be featured.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({ where: { id }, data: { isFeatured } });
    await logAction(req.user.id, isFeatured ? "LISTING_FEATURED" : "LISTING_UNFEATURED", "Listing", id, listing.title, tx);
  });

  sendSuccess(res, { id, isFeatured }, isFeatured ? "Service featured." : "Service no longer featured.");
});

module.exports = { setFeatured };