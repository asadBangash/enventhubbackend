const Stripe = require("stripe");
const env = require("../config/env");
const prisma = require("../config/db");
const { createCommission } = require("./booking.service");
const { notify } = require("./notification.service");

const stripe = env.stripe.secretKey ? new Stripe(env.stripe.secretKey) : null;

const isEnabled = () => Boolean(stripe);

const pkrToStripeAmount = (amountPkr) => {
  const currency = env.stripe.currency;
  if (currency === "usd") {
    return Math.max(50, Math.round((Number(amountPkr) / env.stripe.pkrPerUsd) * 100));
  }
  return Math.round(Number(amountPkr) * 100);
};

const ensureCustomer = async (user) => {
  if (!stripe) return null;
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user.id) },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
};

const finalizeBookingPayment = async (bookingId, session) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, commission: true },
  });
  if (!booking) return { ok: false, reason: "booking_not_found" };
  if (booking.payment?.status === "PAID") return { ok: true, alreadyPaid: true };

  try {
  await prisma.$transaction(async (tx) => {
    const key = session?.id ? `stripe_${session.id}` : `stripe_pi_${session.payment_intent}`;
    await tx.payment.create({
      data: {
        bookingId,
        method: "STRIPE",
        amount: booking.amount,
        buyerFee: 0,
        status: "PAID",
        idempotencyKey: key,
        stripeSessionId: session?.id || null,
        stripePaymentIntentId:
          typeof session?.payment_intent === "string" ? session.payment_intent : session?.payment_intent?.id || null,
      },
    });

    if (!booking.commission) {
      await createCommission(tx, booking);
    }

    await notify(booking.sellerId, "payment", `Payment received for booking #${bookingId}.`, tx);
    await notify(booking.buyerId, "payment", `Your payment for booking #${bookingId} was successful.`, tx);
  });
  } catch (err) {
    if (err.code === "P2002") return { ok: true, alreadyPaid: true };
    throw err;
  }

  return { ok: true };
};

const savePaymentMethodFromSetup = async (userId, paymentMethodId) => {
  if (!stripe || !paymentMethodId) return;
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.type !== "card" || !pm.card) return;

  await prisma.$transaction(async (tx) => {
    const count = await tx.buyerPaymentMethod.count({ where: { userId } });
    await tx.buyerPaymentMethod.create({
      data: {
        userId,
        stripePaymentMethodId: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        isDefault: count === 0,
      },
    });
  });
};

module.exports = {
  stripe,
  isEnabled,
  ensureCustomer,
  pkrToStripeAmount,
  finalizeBookingPayment,
  savePaymentMethodFromSetup,
};