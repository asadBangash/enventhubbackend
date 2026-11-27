const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { oneOf } = require("../utils/helpers");

// GET /api/seller/quotations?status=SENT
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 50);
  const status = oneOf(req.query.status, ["SENT", "ACCEPTED", "DECLINED", "EXPIRED"]);
  const where = { sellerId: req.user.id, ...(status ? { status } : {}) };

  const [rows, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      include: {
        request: {
          select: { id: true, title: true, eventDate: true, buyer: { select: { name: true } } },
        },
        booking: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.offer.count({ where }),
  ]);

  const items = rows.map((o) => ({
    id: o.id,
    requestId: o.requestId,
    request: o.request.title,
    buyer: o.request.buyer.name,
    eventDate: o.request.eventDate ? o.request.eventDate.toISOString() : null,
    amount: Number(o.amount),
    currency: o.currency,
    description: o.description,
    validUntil: o.validUntil ? o.validUntil.toISOString() : null,
    status: o.status,
    bookingId: o.booking ? o.booking.id : null,
    bookingStatus: o.booking ? o.booking.status : null,
    createdAt: o.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

module.exports = { list };