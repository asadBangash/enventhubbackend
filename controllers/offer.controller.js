const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { toBooking } = require("../utils/serializers");
const { bookingInclude } = require("../utils/includes");
const { notify } = require("../services/notification.service");

// POST /api/offers/:id/accept (buyer)
// An accepted quote becomes exactly ONE booking (SRS NFR-08).
const accept = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Quote not found.");

  const booking = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({ where: { id }, include: { request: true } });

    if (!offer || offer.request.buyerId !== req.user.id) {
      throw new AppError("Quote not found.", 404);
    }
    if (offer.validUntil && offer.validUntil < new Date()) {
      throw new AppError("This quote has expired.", 409);
    }

    // Only one request can change SENT -> ACCEPTED, so double clicks cannot create two bookings
    const claimed = await tx.offer.updateMany({
      where: { id, status: "SENT" },
      data: { status: "ACCEPTED" },
    });
    if (claimed.count === 0) {
      throw new AppError("This quote is no longer available.", 409);
    }

    // Other quotes for the same request are closed
    await tx.offer.updateMany({
      where: { requestId: offer.requestId, status: "SENT", id: { not: id } },
      data: { status: "DECLINED" },
    });
    await tx.serviceRequest.update({
      where: { id: offer.requestId },
      data: { status: "ACCEPTED" },
    });

    const created = await tx.booking.create({
      data: {
        buyerId: offer.request.buyerId,
        sellerId: offer.sellerId,
        listingId: offer.request.listingId,
        offerId: offer.id,
        eventId: offer.request.eventId,
        eventDate: offer.request.eventDate,
        amount: offer.amount,
        currency: offer.currency,
        status: "PENDING",
      },
      include: bookingInclude,
    });

    await notify(offer.sellerId, "booking", `Your quote was accepted: ${offer.request.title}`, tx);
    return created;
  });

  sendSuccess(res, toBooking(booking), "Quote accepted. Booking created.", 201);
});

// POST /api/offers/:id/decline (buyer)
const decline = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Quote not found.");

  await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({ where: { id }, include: { request: true } });

    if (!offer || offer.request.buyerId !== req.user.id) {
      throw new AppError("Quote not found.", 404);
    }

    const claimed = await tx.offer.updateMany({
      where: { id, status: "SENT" },
      data: { status: "DECLINED" },
    });
    if (claimed.count === 0) {
      throw new AppError("This quote is no longer available.", 409);
    }

    // If no other open quote remains, the seller may quote again
    const stillOpen = await tx.offer.count({
      where: { requestId: offer.requestId, status: "SENT" },
    });
    if (stillOpen === 0 && offer.request.status === "RESPONDED") {
      await tx.serviceRequest.update({
        where: { id: offer.requestId },
        data: { status: "PENDING" },
      });
    }

    await notify(offer.sellerId, "quote", `Your quote was declined: ${offer.request.title}`, tx);
  });

  sendSuccess(res, null, "Quote declined.");
});

module.exports = { accept, decline };