const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { notify } = require("../services/notification.service");

const toDispute = (d, meId) => ({
  id: d.id,
  bookingId: d.bookingId,
  description: d.description,
  status: d.status,
  resolution: d.resolution,
  raisedByMe: d.raisedById === meId,
  createdAt: d.createdAt.toISOString(),
});

// GET /api/disputes  (disputes on my bookings)
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 50);
  const me = req.user.id;
  const where = { booking: { OR: [{ buyerId: me }, { sellerId: me }] } };

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.dispute.count({ where }),
  ]);

  sendSuccess(res, buildPage(items.map((d) => toDispute(d, me)), total, page, pageSize));
});

// POST /api/disputes  (buyer or seller of the booking)
const create = asyncHandler(async (req, res) => {
  const { bookingId, description } = req.body;
  const me = req.user.id;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || (booking.buyerId !== me && booking.sellerId !== me)) {
    throw new AppError("Booking not found.", 404);
  }
  if (booking.status === "PENDING") {
    throw new AppError("You can raise a dispute after the booking is confirmed.", 409);
  }

  const open = await prisma.dispute.count({
    where: { bookingId, raisedById: me, status: "OPEN" },
  });
  if (open > 0) {
    throw new AppError("You already have an open dispute for this booking.", 409);
  }

  const otherUserId = booking.buyerId === me ? booking.sellerId : booking.buyerId;

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: { bookingId, raisedById: me, description },
    });

    await notify(otherUserId, "dispute", `A dispute was raised on booking #${bookingId}.`, tx);

    const admins = await tx.user.findMany({
      where: { role: "admin", status: "active" },
      select: { id: true },
    });
    for (const admin of admins) {
      await notify(admin.id, "dispute", `New dispute on booking #${bookingId}.`, tx);
    }

    return created;
  });

  sendSuccess(res, toDispute(dispute, me), "Dispute submitted. Our team will review it.", 201);
});

module.exports = { list, create };