const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { availableBalance } = require("../services/payout.service");

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

// GET /api/seller/stats  (the dashboard expects plain numbers)
const stats = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const [
    newRequests,
    pendingBookings,
    activeBookings,
    completedBookings,
    cancelledBookings,
    totalBookings,
    activeServices,
    pendingServices,
    quotesSent,
    quotesAccepted,
    commission,
    rating,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where: { sellerId, status: "PENDING" } }),
    prisma.booking.count({ where: { sellerId, status: "PENDING" } }),
    prisma.booking.count({ where: { sellerId, status: { in: ["CONFIRMED", "IN_PROGRESS"] } } }),
    prisma.booking.count({ where: { sellerId, status: "COMPLETED" } }),
    prisma.booking.count({ where: { sellerId, status: "CANCELLED" } }),
    prisma.booking.count({ where: { sellerId } }),
    prisma.listing.count({ where: { sellerId, status: "APPROVED" } }),
    prisma.listing.count({ where: { sellerId, status: "PENDING" } }),
    prisma.offer.count({ where: { sellerId } }),
    prisma.offer.count({ where: { sellerId, status: "ACCEPTED" } }),
    prisma.commission.aggregate({
      where: { booking: { sellerId } },
      _sum: { amount: true, sellerNet: true },
    }),
    prisma.review.aggregate({
      where: { sellerId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const totalCommission = money(commission._sum.amount);
  const netEarnings = money(commission._sum.sellerNet);
    const [viewTotals, profileRow] = await Promise.all([
    prisma.listing.aggregate({ where: { sellerId }, _sum: { views: true } }),
    prisma.sellerProfile.findUnique({ where: { userId: sellerId }, select: { profileViews: true } }),
  ]);

  sendSuccess(res, {
    newRequests,
    pendingBookings,
    activeBookings,
    completedBookings,
    cancelledBookings,
    totalBookings,
    activeServices,
    pendingServices,
    quotesSent,
    quotesAccepted,
    conversionRate: quotesSent ? Math.round((quotesAccepted / quotesSent) * 100) : 0,
    totalRevenue: money(totalCommission + netEarnings),
    totalCommission,
    netEarnings,
    averageRating: rating._avg.rating ? Math.round(rating._avg.rating * 10) / 10 : 0,
    reviewCount: rating._count,
        serviceViews: viewTotals._sum.views || 0,
    profileViews: profileRow ? profileRow.profileViews : 0,
  });
      
});

// GET /api/seller/earnings  (revenue, commission, net, transaction history: SRS FR-SBK-03)
const earnings = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const where = { booking: { sellerId } };

  const [rows, total, sums] = await Promise.all([
    prisma.commission.findMany({
      where,
      include: {
        booking: {
          include: {
            buyer: { select: { name: true } },
            listing: { select: { title: true } },
            payment: { select: { status: true, method: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.commission.count({ where }),
    prisma.commission.aggregate({ where, _sum: { amount: true, sellerNet: true } }),
  ]);

  const items = rows.map((c) => ({
    bookingId: c.bookingId,
    date: c.createdAt.toISOString(),
    buyer: c.booking.buyer.name,
    service: c.booking.listing ? c.booking.listing.title : null,
    amount: Number(c.booking.amount),
    commissionRate: Number(c.rate),
    commission: Number(c.amount),
    netEarnings: Number(c.sellerNet),
    paymentStatus: c.booking.payment?.status || "UNPAID",
    paid: c.booking.payment?.status === "PAID",
  }));

  const commission = money(sums._sum.amount);
  const netEarnings = money(sums._sum.sellerNet);
  const balance = await availableBalance(req.user.id);

  const result = buildPage(items, total, page, pageSize);
  result.summary = {
    revenue: money(commission + netEarnings),
    commission,
    netEarnings,
    availableBalance: balance,
  };
  sendSuccess(res, result);
});

module.exports = { stats, earnings };