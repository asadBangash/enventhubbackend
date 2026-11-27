const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { oneOf } = require("../utils/helpers");
const { logAction } = require("../services/audit.service");

// GET /api/admin/users?role=buyer&status=active&q=ali  (FR-ADM-02)
const listUsers = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);

  const where = { role: { not: "admin" } };
  const role = oneOf(req.query.role, ["buyer", "seller"]);
  const status = oneOf(req.query.status, ["active", "suspended"]);
  if (role) where.role = role;
  if (status) where.status = status;
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ name: { contains: q } }, { email: { contains: q } }];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        sellerProfile: true,
        _count: { select: { events: true, bookingsAsBuyer: true, bookingsAsSeller: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const items = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    city: u.city,
    role: u.role,
    status: u.status,
    joined: u.createdAt.toISOString(),
    events: u._count.events,
    bookings: u.role === "buyer" ? u._count.bookingsAsBuyer : u._count.bookingsAsSeller,
    businessName: u.sellerProfile ? u.sellerProfile.businessName : null,
    isVerified: u.sellerProfile ? u.sellerProfile.isVerified : null,
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// GET /api/admin/sellers?verification=submitted&q=royal  (FR-ADM-03)
const listSellers = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);

  const where = { role: "seller" };
  const status = oneOf(req.query.status, ["active", "suspended"]);
  const verification = oneOf(req.query.verification, ["not_submitted", "submitted", "approved", "rejected"]);
  if (status) where.status = status;
  if (verification) where.sellerProfile = { is: { verificationStatus: verification } };
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [
      { name: { contains: q } },
      { sellerProfile: { is: { businessName: { contains: q } } } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { sellerProfile: true, _count: { select: { bookingsAsSeller: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const ratings = await prisma.review.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: users.map((u) => u.id) }, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingOf = Object.fromEntries(ratings.map((r) => [r.sellerId, r]));

  const items = users.map((u) => {
    const r = ratingOf[u.id];
    const p = u.sellerProfile;
    return {
      id: u.id,
      businessName: p ? p.businessName : null,
      owner: u.name,
      email: u.email,
      location: p ? p.location : null,
      status: u.status,
      verificationStatus: p ? p.verificationStatus : null,
      isVerified: p ? p.isVerified : false,
      bookings: u._count.bookingsAsSeller,
      rating: r && r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null,
      reviewCount: r ? r._count._all : 0,
      joined: u.createdAt.toISOString(),
    };
  });

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// PATCH /api/admin/users/:id/status  { status: "active" | "suspended" }
// A suspended user is blocked immediately, because every request checks the status.
const setUserStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "User not found.");
  const { status } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === "admin") throw new AppError("User not found.", 404);
  if (user.id === req.user.id) throw new AppError("You cannot change your own account.", 400);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, role: true, status: true },
    });
    await logAction(req.user.id, `USER_${status.toUpperCase()}`, "User", id, user.email, tx);
    return u;
  });

  sendSuccess(res, updated, `Account ${status}.`);
});

module.exports = { listUsers, listSellers, setUserStatus };