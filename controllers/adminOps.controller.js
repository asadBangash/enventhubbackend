const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toEvent } = require("../utils/serializers");
const { oneOf, sellerName } = require("../utils/helpers");
const { logAction } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

const sellerSelect = { select: { name: true, sellerProfile: { select: { businessName: true } } } };

// GET /api/admin/events?q=wedding&status=UPCOMING  (FR-ADM-07)
const listEvents = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const where = {};
  const status = oneOf(req.query.status, ["DRAFT", "UPCOMING", "CANCELLED"]);
  if (status) where.status = status;
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ name: { contains: q } }, { location: { contains: q } }];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { services: true, buyer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.event.count({ where }),
  ]);

  const items = events.map((e) => ({
    ...toEvent(e),
    organizer: e.buyer.name,
    buyerId: e.buyer.id,
    servicesCount: e.services.length,
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// GET /api/admin/reviews?status=PUBLISHED&sellerId=2  (FR-ADM-10)
const listReviews = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const where = {};
  const status = oneOf(req.query.status, ["PUBLISHED", "REMOVED"]);
  if (status) where.status = status;
  if (req.query.sellerId) where.sellerId = Number(req.query.sellerId) || 0;

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        buyer: { select: { name: true } },
        seller: sellerSelect,
        booking: { select: { listing: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    buyer: r.buyer.name,
    seller: sellerName(r.seller),
    service: r.booking.listing ? r.booking.listing.title : null,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// PATCH /api/admin/reviews/:id/status  { status: "PUBLISHED" | "REMOVED" }
const moderateReview = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Review not found.");
  const { status } = req.body;

  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw new AppError("Review not found.", 404);

  const review = await prisma.$transaction(async (tx) => {
    const r = await tx.review.update({ where: { id }, data: { status }, select: { id: true, status: true } });
    await logAction(req.user.id, `REVIEW_${status}`, "Review", id, null, tx);
    return r;
  });

  sendSuccess(res, review, status === "REMOVED" ? "Review removed." : "Review restored.");
});

// GET /api/admin/disputes?status=OPEN  (FR-ADM-11)
const listDisputes = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const status = oneOf(req.query.status, ["OPEN", "RESOLVED", "REJECTED"]);
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: {
        raisedBy: { select: { name: true } },
        booking: { include: { buyer: { select: { name: true } }, seller: sellerSelect } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.dispute.count({ where }),
  ]);

  const items = rows.map((d) => ({
    id: d.id,
    bookingId: d.bookingId,
    buyer: d.booking.buyer.name,
    seller: sellerName(d.booking.seller),
    raisedBy: d.raisedBy.name,
    reason: d.description,
    status: d.status,
    resolution: d.resolution,
    createdAt: d.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// PATCH /api/admin/disputes/:id  { status: "RESOLVED" | "REJECTED", resolution }
const resolveDispute = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Dispute not found.");
  const { status, resolution } = req.body;

  const dispute = await prisma.dispute.findUnique({ where: { id }, include: { booking: true } });
  if (!dispute) throw new AppError("Dispute not found.", 404);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id, status: "OPEN" },
      data: { status, resolution },
    });
    if (claimed.count === 0) throw new AppError("This dispute is already closed.", 409);

    const text = `The dispute on booking #${dispute.bookingId} was ${status.toLowerCase()}.`;
    await notify(dispute.booking.buyerId, "dispute", text, tx);
    await notify(dispute.booking.sellerId, "dispute", text, tx);
    await logAction(req.user.id, `DISPUTE_${status}`, "Dispute", id, null, tx);
  });

  sendSuccess(res, { id, status, resolution }, `Dispute ${status.toLowerCase()}.`);
});

// GET /api/admin/audit-logs  (NFR-15)
const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 30);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.auditLog.count(),
  ]);

  const items = rows.map((l) => ({
    id: l.id,
    admin: l.admin.name,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    details: l.details,
    createdAt: l.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

module.exports = {
  listEvents,
  listReviews,
  moderateReview,
  listDisputes,
  resolveDispute,
  listAuditLogs,
};