const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toRequest, toOffer } = require("../utils/serializers");
const { requestInclude } = require("../utils/includes");
const { notify } = require("../services/notification.service");

// GET /api/requests
// Buyer: their own requests. Seller: requests sent to them.
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 100);
  const where = req.user.role === "buyer" ? { buyerId: req.user.id } : { sellerId: req.user.id };

  const [items, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  sendSuccess(res, buildPage(items.map(toRequest), total, page, pageSize));
});

// POST /api/requests (buyer)
const create = asyncHandler(async (req, res) => {
  const data = req.body;
  let sellerId = null;
  let listingId = null;

  if (data.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: data.listingId } });
    if (!listing || listing.status !== "APPROVED") {
      throw new AppError("Service not found.", 404);
    }
    listingId = listing.id;
    sellerId = listing.sellerId; // we never trust a sellerId sent by the browser
  } else if (data.sellerId) {
    const seller = await prisma.user.findFirst({
      where: { id: data.sellerId, role: "seller", status: "active" },
    });
    if (!seller) throw new AppError("Provider not found.", 404);
    sellerId = seller.id;
  }

  if (data.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: data.eventId, buyerId: req.user.id },
    });
    if (!event) throw new AppError("Event not found.", 404);
  }

  const request = await prisma.serviceRequest.create({
    data: {
      buyerId: req.user.id,
      sellerId,
      listingId,
      eventId: data.eventId ?? null,
      title: data.title,
      eventDate: data.eventDate ?? null,
      location: data.location ?? null,
      minBudget: data.minBudget ?? null,
      maxBudget: data.maxBudget ?? null,
      details: data.details,
    },
    include: requestInclude,
  });

  if (sellerId) {
    await notify(sellerId, "request", `New quote request: ${request.title}`);
  }

  sendSuccess(res, toRequest(request), "Quote request sent.", 201);
});

// POST /api/requests/:id/offers (seller)
const sendOffer = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Request not found.");
  const request = await prisma.serviceRequest.findUnique({ where: { id } });

  if (!request || request.sellerId !== req.user.id) {
    throw new AppError("Request not found.", 404);
  }
  if (!["PENDING", "RESPONDED"].includes(request.status)) {
    throw new AppError("This request is closed.", 409);
  }

  const openOffer = await prisma.offer.count({ where: { requestId: id, status: "SENT" } });
  if (openOffer > 0) {
    throw new AppError("You already sent a quote. Wait for the buyer to respond.", 409);
  }

  const { amount, description, validUntil } = req.body;

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: { requestId: id, sellerId: req.user.id, amount, description, validUntil: validUntil ?? null },
      include: { seller: { select: { name: true } } },
    });
    await tx.serviceRequest.update({ where: { id }, data: { status: "RESPONDED" } });
    await notify(request.buyerId, "quote", `You received a quote for: ${request.title}`, tx);
    return created;
  });

  sendSuccess(res, toOffer(offer), "Quote sent to the buyer.", 201);
});

// POST /api/requests/:id/decline (seller)
const decline = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Request not found.");
  const request = await prisma.serviceRequest.findUnique({ where: { id } });

  if (!request || request.sellerId !== req.user.id) {
    throw new AppError("Request not found.", 404);
  }
  if (!["PENDING", "RESPONDED"].includes(request.status)) {
    throw new AppError("This request is already closed.", 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.offer.updateMany({
      where: { requestId: id, status: "SENT" },
      data: { status: "DECLINED" },
    });
    const r = await tx.serviceRequest.update({
      where: { id },
      data: { status: "DECLINED" },
      include: requestInclude,
    });
    await notify(request.buyerId, "request", `A provider declined your request: ${request.title}`, tx);
    return r;
  });

  sendSuccess(res, toRequest(updated), "Request declined.");
});

module.exports = { list, create, sendOffer, decline };