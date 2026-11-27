const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { removeUploadedFile } = require("../utils/files");
const { portfolioItemSchema } = require("../validators/seller.validator");

const toItem = (p) => ({
  id: p.id,
  imageUrl: p.imageUrl,
  title: p.title,
  description: p.description,
  createdAt: p.createdAt.toISOString(),
});

// GET /api/seller/portfolio
const list = asyncHandler(async (req, res) => {
  const items = await prisma.portfolioItem.findMany({
    where: { sellerId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(res, items.map(toItem));
});

// POST /api/seller/portfolio  (multipart: file + title + optional description)
const create = asyncHandler(async (req, res) => {
  const parsed = portfolioItemSchema.safeParse(req.body);
  if (!parsed.success) {
    removeUploadedFile(req.fileUrl);
    throw parsed.error;
  }

  const count = await prisma.portfolioItem.count({ where: { sellerId: req.user.id } });
  if (count >= 30) {
    removeUploadedFile(req.fileUrl);
    throw new AppError("Your portfolio can have up to 30 items.", 409);
  }

  const item = await prisma.portfolioItem.create({
    data: {
      sellerId: req.user.id,
      imageUrl: req.fileUrl,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    },
  });

  sendSuccess(res, toItem(item), "Portfolio item added.", 201);
});

// DELETE /api/seller/portfolio/:id
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Portfolio item not found.");
  const item = await prisma.portfolioItem.findFirst({ where: { id, sellerId: req.user.id } });
  if (!item) throw new AppError("Portfolio item not found.", 404);

  await prisma.portfolioItem.delete({ where: { id } });
  removeUploadedFile(item.imageUrl);
  sendSuccess(res, null, "Portfolio item removed.", 204);
});

module.exports = { list, create, remove };