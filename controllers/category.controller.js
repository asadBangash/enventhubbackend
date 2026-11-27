const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

// GET /api/categories            -> service categories (default)
// GET /api/categories?type=event -> event categories
const list = asyncHandler(async (req, res) => {
  const type = req.query.type === "event" ? "event" : "service";

  const categories = await prisma.category.findMany({
    where: { type },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  sendSuccess(res, categories);
});

module.exports = { list };