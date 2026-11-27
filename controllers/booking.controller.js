const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toBooking } = require("../utils/serializers");
const { bookingInclude } = require("../utils/includes");
const { notify } = require("../services/notification.service");
const { releaseSlot, markSlotBooked } = require("../services/booking.service");

const STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

// Who may move a booking from which status to which (SRS Figure 6.2)
const TRANSITIONS = {
  buyer: { PENDING: ["CANCELLED"], CONFIRMED: ["CANCELLED"] },
  seller: {
    PENDING: ["CANCELLED", "CONFIRMED"],
    CONFIRMED: ["CANCELLED", "IN_PROGRESS"],
    IN_PROGRESS: ["COMPLETED"],
  },
};

const label = (status) => status.toLowerCase().replace("_", " ");

// GET /api/bookings  (buyer: own bookings, seller: bookings received)
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 100);
  const where = req.user.role === "buyer" ? { buyerId: req.user.id } : { sellerId: req.user.id };

  if (req.query.status) {
    const status = String(req.query.status).toUpperCase();
    if (!STATUSES.includes(status)) throw new AppError("Invalid status filter.", 400);
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);

  sendSuccess(res, buildPage(items.map((b) => toBooking(b, req.user.role)), total, page, pageSize));
});

// GET /api/bookings/:id
const getOne = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Booking not found.");
  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });

  const isParty = booking && (booking.buyerId === req.user.id || booking.sellerId === req.user.id);
  if (!booking || (!isParty && req.user.role !== "admin")) {
    throw new AppError("Booking not found.", 404);
  }

  sendSuccess(res, toBooking(booking, req.user.role));
});

// PATCH /api/bookings/:id/status
const updateStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Booking not found.");
  const { status, note } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  const isBuyer = req.user.role === "buyer" && booking && booking.buyerId === req.user.id;
  const isSeller = req.user.role === "seller" && booking && booking.sellerId === req.user.id;
  if (!booking || (!isBuyer && !isSeller)) throw new AppError("Booking not found.", 404);

  const allowed = (TRANSITIONS[req.user.role] || {})[booking.status] || [];
  if (!allowed.includes(status)) {
    throw new AppError(`You cannot change a ${label(booking.status)} booking to ${label(status)}.`, 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Only one request can win this change, so double clicks are harmless
    const claimed = await tx.booking.updateMany({
      where: { id, status: booking.status },
      data: { status, ...(note ? { note } : {}) },
    });
    if (claimed.count === 0) {
      throw new AppError("This booking was just changed. Please refresh.", 409);
    }

    if (status === "CANCELLED") {
      if (booking.payment && booking.payment.status === "PAID") {
        await tx.payment.update({ where: { bookingId: id }, data: { status: "REFUNDED" } });
      }
      await releaseSlot(tx, booking);
    }

    if (status === "CONFIRMED" && booking.status === "PENDING") {
      await markSlotBooked(tx, booking.sellerId, booking.eventDate);
    }

    if (status === "COMPLETED") {
      await notify(
        booking.buyerId,
        "payment",
        `Booking #${id} is complete. Please pay the provider via Stripe.`,
        tx
      );
      await notify(booking.buyerId, "review", `Booking #${id} is complete. You can leave a review after payment.`, tx);
    }

    const otherUserId = isBuyer ? booking.sellerId : booking.buyerId;
    await notify(otherUserId, "booking", `Booking #${id} is now ${label(status)}.`, tx);

    return tx.booking.findUnique({ where: { id }, include: bookingInclude });
  });

  sendSuccess(res, toBooking(updated, req.user.role), "Booking updated.");
});

module.exports = { list, getOne, updateStatus };