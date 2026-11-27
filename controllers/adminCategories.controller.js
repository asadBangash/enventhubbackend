const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { logAction } = require("../services/audit.service");

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toCategory = (c) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  type: c.type,
  listings: c._count ? c._count.listings : 0,
  sellers: c._count ? c._count.sellerProfiles : 0,
  createdAt: c.createdAt.toISOString(),
});

// GET /api/admin/categories  (FR-ADM-05)
const list = asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { listings: true, sellerProfiles: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  sendSuccess(res, categories.map(toCategory));
});

// POST /api/admin/categories  { name, type }
const create = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  const slug = slugify(name);
  if (!slug) throw new AppError("Enter a valid category name.", 400);

  let category;
  try {
    category = await prisma.category.create({ data: { name, slug, type } });
  } catch (err) {
    if (err.code === "P2002") throw new AppError("A category with this name already exists.", 409);
    throw err;
  }

  await logAction(req.user.id, "CATEGORY_CREATED", "Category", category.id, name);
  sendSuccess(res, toCategory(category), "Category created.", 201);
});

// PATCH /api/admin/categories/:id  { name }  (the slug stays the same so links keep working)
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Category not found.");
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found.", 404);

  const category = await prisma.category.update({ where: { id }, data: { name: req.body.name } });
  await logAction(req.user.id, "CATEGORY_RENAMED", "Category", id, `${existing.name} -> ${category.name}`);
  sendSuccess(res, toCategory(category), "Category updated.");
});

// DELETE /api/admin/categories/:id  (blocked while services or sellers use it)
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Category not found.");
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { listings: true, sellerProfiles: true } } },
  });
  if (!category) throw new AppError("Category not found.", 404);

  if (category._count.listings > 0 || category._count.sellerProfiles > 0) {
    throw new AppError("This category is in use. Rename it instead of deleting it.", 409);
  }

  await prisma.category.delete({ where: { id } });
  await logAction(req.user.id, "CATEGORY_DELETED", "Category", id, category.name);
  sendSuccess(res, null, "Category deleted.", 204);
});

module.exports = { list, create, update, remove };