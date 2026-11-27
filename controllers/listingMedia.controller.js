const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { toListing } = require("../utils/serializers");
const { listingInclude } = require("../utils/includes");
const { removeUploadedFile } = require("../utils/files");

// PUT /api/listings/:id/packages  (seller). Replaces all packages of the service.
const setPackages = asyncHandler(async (req, res) => {
  const listing = req.listing;
  const { packages } = req.body;

  await prisma.$transaction(async (tx) => {
    await tx.package.deleteMany({ where: { listingId: listing.id } });
    await tx.package.createMany({
      data: packages.map((p) => ({
        listingId: listing.id,
        tier: p.tier,
        name: p.name ?? null,
        price: p.price,
        inclusions: p.inclusions,
      })),
    });
    // Changing prices sends an approved service back for review
    if (listing.status === "APPROVED") {
      await tx.listing.update({ where: { id: listing.id }, data: { status: "PENDING" } });
    }
  });

  const updated = await prisma.listing.findUnique({
    where: { id: listing.id },
    include: listingInclude,
  });
  sendSuccess(res, toListing(updated), "Packages saved.");
});

// POST /api/listings/:id/images  (seller, multipart: file + optional altText)
const addImage = asyncHandler(async (req, res) => {
  const listing = req.listing;

  const count = await prisma.listingImage.count({ where: { listingId: listing.id } });
  if (count >= 10) {
    removeUploadedFile(req.fileUrl);
    throw new AppError("A service can have up to 10 images.", 409);
  }

  const altText =
    typeof req.body.altText === "string" ? req.body.altText.trim().slice(0, 150) || null : null;

  const image = await prisma.listingImage.create({
    data: { listingId: listing.id, url: req.fileUrl, altText, sortOrder: count },
  });

  sendSuccess(res, { id: image.id, url: image.url, altText: image.altText }, "Image added.", 201);
});

// DELETE /api/listings/:id/images/:imageId  (seller)
const removeImage = asyncHandler(async (req, res) => {
  const imageId = parseId(req.params.imageId, "Image not found.");
  const image = await prisma.listingImage.findFirst({
    where: { id: imageId, listingId: req.listing.id },
  });
  if (!image) throw new AppError("Image not found.", 404);

  await prisma.listingImage.delete({ where: { id: imageId } });
  removeUploadedFile(image.url);
  sendSuccess(res, null, "Image removed.", 204);
});

module.exports = { setPackages, addImage, removeImage };