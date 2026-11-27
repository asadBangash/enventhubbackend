const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toListing } = require("../utils/serializers");
const { listingInclude } = require("../utils/includes");
const { oneOf, money, sellerName } = require("../utils/helpers");
const { logAction } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

const LISTING_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"];

// GET /api/admin/dashboard  (FR-ADM-01)
const dashboard = asyncHandler(async (req, res) => {
  const [
    buyers,
    sellers,
    activeListings,
    pendingListings,
    pendingVerifications,
    openDisputes,
    totalBookings,
    completedBookings,
    revenue,
    commission,
    recent,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "buyer" } }),
    prisma.user.count({ where: { role: "seller" } }),
    prisma.listing.count({ where: { status: "APPROVED" } }),
    prisma.listing.count({ where: { status: "PENDING" } }),
    prisma.verificationRequest.count({ where: { status: "submitted" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.commission.aggregate({ _sum: { amount: true } }),
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { name: true } },
        seller: { select: { name: true, sellerProfile: { select: { businessName: true } } } },
        listing: { select: { title: true } },
      },
    }),
  ]);

  sendSuccess(res, {
    buyers,
    sellers,
    activeListings,
    pendingListings,
    pendingVerifications,
    openDisputes,
    totalBookings,
    completedBookings,
    totalRevenue: money(revenue._sum.amount),
    totalCommission: money(commission._sum.amount),
    recentBookings: recent.map((b) => ({
      id: b.id,
      buyer: b.buyer.name,
      seller: sellerName(b.seller),
      service: b.listing ? b.listing.title : null,
      amount: Number(b.amount),
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
  });
});

// GET /api/admin/listings?status=PENDING&q=catering  (FR-ADM-06)
const listListings = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const status = oneOf(req.query.status, LISTING_STATUSES);
  const where = status ? { status } : { status: { not: "ARCHIVED" } };
  if (req.query.q) where.title = { contains: String(req.query.q) };

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: listingInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.listing.count({ where }),
  ]);

  sendSuccess(res, buildPage(items.map(toListing), total, page, pageSize));
});

// PATCH /api/admin/listings/:id/status
const moderateListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Service not found.");
  const status = req.body.status;

  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || existing.status === "ARCHIVED") {
    throw new AppError("Service not found.", 404);
  }

  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id },
      data: { status },
      select: { id: true, title: true, status: true },
    });
    await logAction(req.user.id, `LISTING_${status}`, "Listing", id, existing.title, tx);
    await notify(existing.sellerId, "listing", `Your service "${existing.title}" was ${status.toLowerCase()}.`, tx);
    return updated;
  });

  sendSuccess(res, listing, `Service ${status.toLowerCase()}.`);
});

module.exports = { dashboard, listListings, moderateListing };