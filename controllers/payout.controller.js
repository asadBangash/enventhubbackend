const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { availableBalance } = require("../services/payout.service");

// GET /api/payouts/balance  (seller)
const balance = asyncHandler(async (req, res) => {
  const avail = await availableBalance(req.user.id);
  sendSuccess(res, { availableBalance: avail, currency: "PKR" });
});

// GET /api/payouts  (seller)
const listMine = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const [rows, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { sellerId: req.user.id },
      include: { payoutMethod: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.payoutRequest.count({ where: { sellerId: req.user.id } }),
  ]);

  const items = rows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    note: p.note,
    payoutMethod: p.payoutMethod
      ? { label: p.payoutMethod.label, bankName: p.payoutMethod.bankName }
      : null,
    createdAt: p.createdAt.toISOString(),
    processedAt: p.processedAt ? p.processedAt.toISOString() : null,
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// POST /api/payouts  (seller)
const create = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  const payoutMethodId = req.body.payoutMethodId ? Number(req.body.payoutMethodId) : null;
  if (!amount || amount <= 0) throw new AppError("Enter a valid payout amount.", 400);

  const avail = await availableBalance(req.user.id);
  if (amount > avail) {
    throw new AppError(`Maximum available for payout is PKR ${avail.toLocaleString()}.`, 409);
  }

  if (payoutMethodId) {
    const method = await prisma.sellerPayoutMethod.findFirst({
      where: { id: payoutMethodId, userId: req.user.id },
    });
    if (!method) throw new AppError("Payout method not found.", 404);
  }

  const request = await prisma.payoutRequest.create({
    data: {
      sellerId: req.user.id,
      amount,
      payoutMethodId,
      note: req.body.note?.trim() || null,
    },
  });

  sendSuccess(
    res,
    { id: request.id, amount: Number(request.amount), status: request.status },
    "Payout request submitted. Admin will process it.",
    201
  );
});

// GET /api/admin/payouts
const listAdmin = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      include: {
        seller: { select: { name: true, email: true, sellerProfile: { select: { businessName: true } } } },
        payoutMethod: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.payoutRequest.count({ where }),
  ]);

  const items = rows.map((p) => ({
    id: p.id,
    seller: p.seller.sellerProfile?.businessName || p.seller.name,
    email: p.seller.email,
    amount: Number(p.amount),
    status: p.status,
    payoutMethod: p.payoutMethod?.label || null,
    createdAt: p.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// PATCH /api/admin/payouts/:id
const updateAdmin = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Payout request not found.");
  const status = String(req.body.status || "").toUpperCase();
  if (!["APPROVED", "PAID", "REJECTED"].includes(status)) {
    throw new AppError("Status must be APPROVED, PAID, or REJECTED.", 400);
  }

  const existing = await prisma.payoutRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError("Payout request not found.", 404);

  const updated = await prisma.payoutRequest.update({
    where: { id },
    data: {
      status,
      processedAt: status === "PAID" || status === "REJECTED" ? new Date() : existing.processedAt,
    },
  });

  sendSuccess(res, { id: updated.id, status: updated.status }, "Payout request updated.");
});

module.exports = { balance, listMine, create, listAdmin, updateAdmin };