const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toReview } = require("../utils/serializers");
const { notify } = require("../services/notification.service");

// GET /api/reviews?sellerId=2  (public: published reviews only)
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const where = { status: "PUBLISHED" };

  if (req.query.sellerId) {
    const sellerId = Number(req.query.sellerId);
    where.sellerId = Number.isInteger(sellerId) && sellerId > 0 ? sellerId : 0;
  }

  const [items, total, agg] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { buyer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
  ]);

  const result = buildPage(items.map(toReview), total, page, pageSize);
  result.summary = {
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    count: total,
  };

  sendSuccess(res, result);
});

// POST /api/reviews (buyer, completed bookings only, one review per booking)
const create = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.buyerId !== req.user.id) {
    throw new AppError("Booking not found.", 404);
  }
  if (booking.status !== "COMPLETED") {
    throw new AppError("You can review a service only after it is completed.", 409);
  }

  let review;
  try {
    review = await prisma.review.create({
      data: {
        bookingId,
        buyerId: req.user.id,
        sellerId: booking.sellerId,
        rating,
        comment: comment ?? "",
      },
      include: { buyer: { select: { id: true, name: true } } },
    });
  } catch (err) {
    if (err.code === "P2002") throw new AppError("You already reviewed this booking.", 409);
    throw err;
  }

  await notify(booking.sellerId, "review", `You received a ${rating}-star review.`);
  sendSuccess(res, toReview(review), "Thank you for your review.", 201);
});

module.exports = { list, create };