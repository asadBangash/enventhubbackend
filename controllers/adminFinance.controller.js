const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { oneOf, money, sellerName } = require("../utils/helpers");

const sellerSelect = { select: { name: true, sellerProfile: { select: { businessName: true } } } };

// GET /api/admin/bookings?status=CONFIRMED  (FR-ADM-08)
const listBookings = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const status = oneOf(req.query.status, ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        buyer: { select: { name: true } },
        seller: sellerSelect,
        listing: { select: { title: true } },
        event: { select: { name: true } },
        payment: true,
        commission: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);

  const items = rows.map((b) => ({
    id: b.id,
    buyer: b.buyer.name,
    seller: sellerName(b.seller),
    service: b.listing ? b.listing.title : null,
    event: b.event ? b.event.name : null,
    amount: Number(b.amount),
    commission: b.commission ? Number(b.commission.amount) : null,
    date: b.eventDate ? b.eventDate.toISOString() : null,
    status: b.status,
    paymentStatus: b.payment ? b.payment.status : "NONE",
    createdAt: b.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// GET /api/admin/payments?status=PAID
const listPayments = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const status = oneOf(req.query.status, ["PENDING", "PAID", "FAILED", "REFUNDED"]);
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { booking: { include: { buyer: { select: { name: true } }, seller: sellerSelect } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
  ]);

  const items = rows.map((p) => ({
    id: p.id,
    bookingId: p.bookingId,
    buyer: p.booking.buyer.name,
    seller: sellerName(p.booking.seller),
    amount: Number(p.amount),
    buyerFee: Number(p.buyerFee),
    method: p.method,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// GET /api/admin/commissions  (FR-ADM-09)
const listCommissions = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);

  const [rows, total, sums] = await Promise.all([
    prisma.commission.findMany({
      include: { booking: { include: { seller: sellerSelect } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.commission.count(),
    prisma.commission.aggregate({ _sum: { amount: true, sellerNet: true } }),
  ]);

  const items = rows.map((c) => ({
    id: c.id,
    bookingId: c.bookingId,
    seller: sellerName(c.booking.seller),
    bookingAmount: Number(c.booking.amount),
    rate: Number(c.rate),
    commission: Number(c.amount),
    sellerNet: Number(c.sellerNet),
    createdAt: c.createdAt.toISOString(),
  }));

  const result = buildPage(items, total, page, pageSize);
  result.summary = {
    totalCommission: money(sums._sum.amount),
    totalSellerNet: money(sums._sum.sellerNet),
  };
  sendSuccess(res, result);
});

// GET /api/admin/reports?months=6  (FR-ADM-12)
const reports = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 12);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [bookings, commissions, topRows, roleCounts] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, status: true, amount: true },
    }),
    prisma.commission.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, amount: true },
    }),
    prisma.booking.groupBy({
      by: ["sellerId"],
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  // One row for every month in the range, even months with no activity
  const monthly = {};
  for (let i = 0; i < months; i++) {
    const key = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))
      .toISOString()
      .slice(0, 7);
    monthly[key] = { month: key, bookings: 0, completedBookings: 0, revenue: 0, commission: 0 };
  }

  bookings.forEach((b) => {
    const row = monthly[b.createdAt.toISOString().slice(0, 7)];
    if (!row) return;
    row.bookings += 1;
    if (b.status === "COMPLETED") {
      row.completedBookings += 1;
      row.revenue += Number(b.amount);
    }
  });
  commissions.forEach((c) => {
    const row = monthly[c.createdAt.toISOString().slice(0, 7)];
    if (row) row.commission += Number(c.amount);
  });
  Object.values(monthly).forEach((row) => {
    row.revenue = money(row.revenue);
    row.commission = money(row.commission);
  });

  const sellers = await prisma.user.findMany({
    where: { id: { in: topRows.map((t) => t.sellerId) } },
    select: { id: true, name: true, sellerProfile: { select: { businessName: true } } },
  });
  const sellerById = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const users = { buyers: 0, sellers: 0, admins: 0 };
  roleCounts.forEach((r) => {
    users[r.role + "s"] = r._count._all;
  });

  sendSuccess(res, {
    months,
    monthly: Object.values(monthly),
    topSellers: topRows.map((t) => ({
      sellerId: t.sellerId,
      name: sellerName(sellerById[t.sellerId]),
      completedBookings: t._count._all,
      revenue: money(t._sum.amount),
    })),
    users,
  });
});

module.exports = { listBookings, listPayments, listCommissions, reports };