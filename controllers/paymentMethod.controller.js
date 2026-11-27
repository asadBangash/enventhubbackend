const prisma = require("../config/db");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { stripe, isEnabled, ensureCustomer } = require("../services/stripe.service");

const maskAccount = (num) => (num.length <= 4 ? num : `****${num.slice(-4)}`);

// GET /api/payment-methods
const list = asyncHandler(async (req, res) => {
  if (req.user.role === "seller") {
    const items = await prisma.sellerPayoutMethod.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return sendSuccess(
      res,
      items.map((m) => ({
        id: m.id,
        label: m.label,
        accountHolder: m.accountHolder,
        bankName: m.bankName,
        accountNumberMasked: maskAccount(m.accountNumber),
        isDefault: m.isDefault,
      }))
    );
  }

  const items = await prisma.buyerPaymentMethod.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(
    res,
    items.map((m) => ({
      id: m.id,
      brand: m.brand,
      last4: m.last4,
      expMonth: m.expMonth,
      expYear: m.expYear,
      isDefault: m.isDefault,
    }))
  );
});

// POST /api/payment-methods/stripe-setup  (buyer — add card via Stripe)
const createStripeSetup = asyncHandler(async (req, res) => {
  if (req.user.role !== "buyer") throw new AppError("Only organizers can save cards.", 403);
  if (!isEnabled()) throw new AppError("Stripe is not configured.", 503);

  const customerId = await ensureCustomer(req.user);
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    metadata: { userId: String(req.user.id), purpose: "save_card" },
    success_url: `${env.clientUrl}/buyer/settings?card_saved=1`,
    cancel_url: `${env.clientUrl}/buyer/settings?card_cancelled=1`,
  });

  sendSuccess(res, { url: session.url }, "Open Stripe to add a payment method.");
});

// POST /api/payment-methods/payout  (seller)
const addPayoutMethod = asyncHandler(async (req, res) => {
  if (req.user.role !== "seller") throw new AppError("Only providers can add payout methods.", 403);
  const { label, accountHolder, accountNumber, bankName, isDefault } = req.body;
  if (!label?.trim() || !accountHolder?.trim() || !accountNumber?.trim()) {
    throw new AppError("Label, account holder, and account number are required.", 400);
  }

  const method = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.sellerPayoutMethod.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    }
    const count = await tx.sellerPayoutMethod.count({ where: { userId: req.user.id } });
    return tx.sellerPayoutMethod.create({
      data: {
        userId: req.user.id,
        label: label.trim(),
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName?.trim() || null,
        isDefault: isDefault ?? count === 0,
      },
    });
  });

  sendSuccess(
    res,
    {
      id: method.id,
      label: method.label,
      accountHolder: method.accountHolder,
      bankName: method.bankName,
      accountNumberMasked: maskAccount(method.accountNumber),
      isDefault: method.isDefault,
    },
    "Payout method saved.",
    201
  );
});

// DELETE /api/payment-methods/:id
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Payment method not found.");
  if (req.user.role === "seller") {
    const row = await prisma.sellerPayoutMethod.findFirst({ where: { id, userId: req.user.id } });
    if (!row) throw new AppError("Payment method not found.", 404);
    await prisma.sellerPayoutMethod.delete({ where: { id } });
  } else {
    const row = await prisma.buyerPaymentMethod.findFirst({ where: { id, userId: req.user.id } });
    if (!row) throw new AppError("Payment method not found.", 404);
    await prisma.buyerPaymentMethod.delete({ where: { id } });
  }
  sendSuccess(res, null, "Payment method removed.");
});

module.exports = { list, createStripeSetup, addPayoutMethod, remove };