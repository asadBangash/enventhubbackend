const prisma = require("../config/db");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { toBooking } = require("../utils/serializers");
const { bookingInclude } = require("../utils/includes");
const { notify } = require("../services/notification.service");
const {
  stripe,
  isEnabled,
  ensureCustomer,
  pkrToStripeAmount,
  finalizeBookingPayment,
} = require("../services/stripe.service");

const toPayment = (p) => ({
  id: p.id,
  bookingId: p.bookingId,
  method: p.method,
  amount: Number(p.amount),
  buyerFee: Number(p.buyerFee),
  status: p.status,
});

const assertPayableBooking = async (bookingId, buyerId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking || booking.buyerId !== buyerId) throw new AppError("Booking not found.", 404);
  if (booking.status !== "COMPLETED") {
    throw new AppError("Payment is available after the service is marked completed.", 409);
  }
  if (booking.payment?.status === "PAID") throw new AppError("This booking is already paid.", 409);
  return booking;
};

// GET /api/payments/config
const config = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    stripeEnabled: isEnabled(),
    publishableKey: env.stripe.publishableKey,
    currency: env.stripe.currency,
  });
});

// POST /api/payments/checkout  (buyer) — Stripe Checkout after completion
const createCheckout = asyncHandler(async (req, res) => {
  if (!isEnabled()) throw new AppError("Stripe is not configured. Add STRIPE_SECRET_KEY to .env.", 503);

  const { bookingId } = req.body;
  const booking = await assertPayableBooking(bookingId, req.user.id);
  const customerId = await ensureCustomer(req.user);

  const amount = pkrToStripeAmount(booking.amount);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripe.currency,
          unit_amount: amount,
          product_data: {
            name: booking.listing?.title || `Booking #${booking.id}`,
            description: `EventHub — pay provider after service completion (booking #${booking.id})`,
          },
        },
      },
    ],
    metadata: {
      bookingId: String(booking.id),
      buyerId: String(req.user.id),
      purpose: "booking_payment",
    },
    success_url: `${env.clientUrl}/buyer/payment/success?bookingId=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/buyer/payment?bookingId=${booking.id}&cancelled=1`,
  });

  sendSuccess(res, { url: session.url, sessionId: session.id }, "Redirect to Stripe to complete payment.");
});

// POST /api/payments/confirm-session  (buyer) — dev/local without webhooks
const confirmSession = asyncHandler(async (req, res) => {
  if (!isEnabled()) throw new AppError("Stripe is not configured.", 503);
  const { sessionId, bookingId } = req.body;
  const booking = await assertPayableBooking(bookingId, req.user.id);

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.bookingId !== String(booking.id)) {
    throw new AppError("This checkout session does not match the booking.", 400);
  }
  if (session.payment_status !== "paid") {
    throw new AppError("Payment is not completed yet.", 409);
  }

  await finalizeBookingPayment(booking.id, session);
  const fresh = await prisma.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });
  sendSuccess(res, { booking: toBooking(fresh, "buyer") }, "Payment confirmed.");
});

// POST /api/payments (buyer) — demo fallback when Stripe keys are absent
const createDemo = asyncHandler(async (req, res) => {
  if (isEnabled()) {
    throw new AppError("Use Stripe checkout for payments.", 400);
  }

  const { bookingId, idempotencyKey } = req.body;
  const booking = await assertPayableBooking(bookingId, req.user.id);

  if (booking.payment) {
    if (booking.payment.idempotencyKey === idempotencyKey) {
      return sendSuccess(
        res,
        { payment: toPayment(booking.payment), booking: toBooking(booking, "buyer") },
        "Payment already processed."
      );
    }
    throw new AppError("This booking is already paid.", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        bookingId,
        method: "DEMO",
        amount: booking.amount,
        buyerFee: 0,
        status: "PAID",
        idempotencyKey,
      },
    });

    const { createCommission } = require("../services/booking.service");
    await createCommission(tx, booking);
    await notify(booking.sellerId, "payment", `Payment received for booking #${bookingId}.`, tx);
    await notify(booking.buyerId, "payment", `Payment recorded for booking #${bookingId}.`, tx);

    const fresh = await tx.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
    return { payment, booking: fresh };
  });

  sendSuccess(
    res,
    { payment: toPayment(result.payment), booking: toBooking(result.booking, "buyer") },
    "Demo payment successful. Commission recorded.",
    201
  );
});

// Stripe webhook handler (mounted with raw body)
const handleWebhook = async (req, res) => {
  if (!stripe) return res.status(503).send("Stripe not configured");
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = env.stripe.webhookSecret
      ? stripe.webhooks.constructEvent(req.body, sig, env.stripe.webhookSecret)
      : JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.purpose === "booking_payment" && session.metadata?.bookingId) {
        await finalizeBookingPayment(Number(session.metadata.bookingId), session);
      }
      if (session.metadata?.purpose === "save_card" && session.metadata?.userId) {
        const { savePaymentMethodFromSetup } = require("../services/stripe.service");
        const pmId =
          typeof session.setup_intent === "string"
            ? (await stripe.setupIntents.retrieve(session.setup_intent)).payment_method
            : session.setup_intent?.payment_method;
        if (typeof pmId === "string") {
          await savePaymentMethodFromSetup(Number(session.metadata.userId), pmId);
        }
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return res.status(500).send("Webhook handler failed");
  }

  res.json({ received: true });
};

module.exports = { config, createCheckout, confirmSession, createDemo, handleWebhook, toPayment };