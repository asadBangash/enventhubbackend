const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toListing } = require("../utils/serializers");
const { listingInclude: include } = require("../utils/includes");

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError("Service not found.", 404);
  }
  return id;
};

// Category must exist and be a service category.
const checkCategory = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category || category.type !== "service") {
    throw new AppError("Invalid service category.", 400);
  }
};

// Returns seller ratings.
const ratingsFor = async (sellerIds) => {
  if (!sellerIds.length) return {};

  const rows = await prisma.review.groupBy({
    by: ["sellerId"],
    where: {
      sellerId: { in: sellerIds },
      status: "PUBLISHED",
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return Object.fromEntries(
    rows.map((row) => [
      row.sellerId,
      {
        average: row._avg.rating
          ? Math.round(row._avg.rating * 10) / 10
          : null,
        count: row._count._all,
      },
    ])
  );
};

// GET /api/listings
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);

  const {
    q,
    location,
    categoryId,
    minPrice,
    maxPrice,
    verified,
    sellerId,
    mine,
    minRating,
    availableOn,
    featured,
  } = req.query;

  const where = {};
  const sellerWhere = {};

  if (mine === "true") {
    if (!req.user) {
      throw new AppError("Please log in to continue.", 401);
    }

    if (req.user.role !== "seller") {
      throw new AppError(
        "You do not have permission to do this.",
        403
      );
    }

    where.sellerId = req.user.id;
    where.status = { not: "ARCHIVED" };
  } else {
    where.status = "APPROVED";
    sellerWhere.status = "active";

    if (sellerId) {
      where.sellerId = Number(sellerId) || 0;
    }
  }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (location) {
    where.location = { contains: location };
  }

  if (categoryId) {
    where.categoryId = Number(categoryId) || 0;
  }

  if (minPrice || maxPrice) {
    where.price = {};

    if (minPrice) {
      where.price.gte = Number(minPrice) || 0;
    }

    if (maxPrice) {
      where.price.lte = Number(maxPrice) || 0;
    }
  }

  // Featured listings.
  if (featured === "true") {
    where.isFeatured = true;
  }

  if (verified === "true") {
    sellerWhere.sellerProfile = {
      is: { isVerified: true },
    };
  }

  // Availability filter.
  if (availableOn && /^\d{4}-\d{2}-\d{2}$/.test(availableOn)) {
    const day = new Date(`${availableOn}T00:00:00.000Z`);

    if (
      !Number.isNaN(day.getTime()) &&
      day.toISOString().slice(0, 10) === availableOn
    ) {
      sellerWhere.availabilitySlots = {
        none: {
          date: day,
          state: { in: ["BOOKED", "UNAVAILABLE"] },
        },
      };
    }
  }

  // Minimum seller rating filter.
  if (minRating) {
    const min = Number(minRating);

    if (!Number.isNaN(min)) {
      const good = await prisma.review.groupBy({
        by: ["sellerId"],
        where: { status: "PUBLISHED" },
        _avg: { rating: true },
        having: {
          rating: { _avg: { gte: min } },
        },
      });

      const ids = good.map((row) => row.sellerId);

      where.sellerId =
        typeof where.sellerId === "number"
          ? ids.includes(where.sellerId)
            ? where.sellerId
            : 0
          : { in: ids };
    }
  }

  if (Object.keys(sellerWhere).length) {
    where.seller = sellerWhere;
  }

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include,
      orderBy: [
        { isFeatured: "desc" },
        { createdAt: "desc" },
      ],
      skip,
      take,
    }),

    prisma.listing.count({ where }),
  ]);

  const ratings = await ratingsFor([
    ...new Set(items.map((listing) => listing.sellerId)),
  ]);

  sendSuccess(
    res,
    buildPage(
      items.map((listing) =>
        toListing(listing, ratings[listing.sellerId])
      ),
      total,
      page,
      pageSize
    )
  );
});

// GET /api/listings/:id
const getOne = asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: parseId(req.params.id) },
    include,
  });

  if (!listing) {
    throw new AppError("Service not found.", 404);
  }

  const isOwnerOrAdmin =
    req.user &&
    (req.user.role === "admin" ||
      req.user.id === listing.sellerId);

  if (listing.status !== "APPROVED" && !isOwnerOrAdmin) {
    throw new AppError("Service not found.", 404);
  }

  // Count views.
  if (
    listing.status === "APPROVED" &&
    !(req.user && req.user.id === listing.sellerId)
  ) {
    prisma.listing
      .update({
        where: { id: listing.id },
        data: { views: { increment: 1 } },
      })
      .catch(() => {});
  }

  const ratings = await ratingsFor([listing.sellerId]);

  sendSuccess(
    res,
    toListing(listing, ratings[listing.sellerId])
  );
});

// POST /api/listings
const create = asyncHandler(async (req, res) => {
  const data = req.body;

  await checkCategory(data.categoryId);

  const listing = await prisma.listing.create({
    data: {
      sellerId: req.user.id,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description ?? "",
      location: data.location ?? null,
      price: data.price,
      pricingType: data.pricingType ?? "fixed",
      features: data.features ?? null,
      terms: data.terms ?? null,
      status: data.status ?? "DRAFT",
    },
    include,
  });

  sendSuccess(
    res,
    toListing(listing),
    "Service saved successfully.",
    201
  );
});

// PATCH /api/listings/:id
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const existing = await prisma.listing.findUnique({
    where: { id },
  });

  if (
    !existing ||
    existing.sellerId !== req.user.id ||
    existing.status === "ARCHIVED"
  ) {
    throw new AppError("Service not found.", 404);
  }

  const data = { ...req.body };

  if (data.categoryId !== undefined) {
    await checkCategory(data.categoryId);
  }

  // Approved listings return for review after editing.
  if (
    existing.status === "APPROVED" &&
    data.status === undefined
  ) {
    data.status = "PENDING";
  }

  const listing = await prisma.listing.update({
    where: { id },
    data,
    include,
  });

  sendSuccess(
    res,
    toListing(listing),
    "Service updated successfully."
  );
});

// DELETE /api/listings/:id
// Archive listing instead of permanently deleting.
const archive = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const existing = await prisma.listing.findUnique({
    where: { id },
  });

  if (
    !existing ||
    existing.sellerId !== req.user.id ||
    existing.status === "ARCHIVED"
  ) {
    throw new AppError("Service not found.", 404);
  }

  await prisma.listing.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  sendSuccess(res, null, "Service archived.", 204);
});

module.exports = {
  list,
  getOne,
  create,
  update,
  archive,
};