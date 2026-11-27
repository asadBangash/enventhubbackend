const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toEvent } = require("../utils/serializers");

const include = { services: true };
const REQUIRED = ["category", "eventDate", "eventTime", "location", "guests", "budget"];

// Loads an event and makes sure it belongs to this buyer
const findOwned = async (id, userId) => {
  const event = await prisma.event.findUnique({ where: { id }, include });
  if (!event || event.buyerId !== userId) throw new AppError("Event not found.", 404);
  return event;
};

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 100);
  const where = { buyerId: req.user.id };

  const [items, total] = await Promise.all([
    prisma.event.findMany({ where, include, orderBy: { eventDate: "asc" }, skip, take }),
    prisma.event.count({ where }),
  ]);

  sendSuccess(res, buildPage(items.map(toEvent), total, page, pageSize));
});

const getOne = asyncHandler(async (req, res) => {
  const event = await findOwned(parseId(req.params.id, "Event not found."), req.user.id);
  sendSuccess(res, toEvent(event));
});

const create = asyncHandler(async (req, res) => {
  const { services = [], ...data } = req.body;

  const event = await prisma.event.create({
    data: {
      ...data,
      buyerId: req.user.id,
      description: data.description ?? null,
      status: data.status ?? "UPCOMING",
      services: { create: services.map((serviceType) => ({ serviceType })) },
    },
    include,
  });

  sendSuccess(res, toEvent(event), "Event created successfully.", 201);
});

const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Event not found.");
  const existing = await findOwned(id, req.user.id);

  const { services, ...data } = req.body;

  // A draft can stay incomplete. A published event must have every detail.
  const merged = { ...existing, ...data };
  if (merged.status !== "DRAFT") {
    const missing = REQUIRED.filter((key) => merged[key] === null || merged[key] === undefined);
    if (missing.length) {
      throw new AppError("Complete these fields before publishing the event: " + missing.join(", "), 400);
    }
  }

  const event = await prisma.$transaction(async (tx) => {
    if (services) {
      // Keep the progress of services that stay on the event
      const oldStatus = new Map(existing.services.map((s) => [s.serviceType, s.status]));
      await tx.eventService.deleteMany({ where: { eventId: id } });
      await tx.eventService.createMany({
        data: services.map((serviceType) => ({
          eventId: id,
          serviceType,
          status: oldStatus.get(serviceType) || "NEEDED",
        })),
      });
    }
    return tx.event.update({ where: { id }, data, include });
  });

  sendSuccess(res, toEvent(event), "Event updated successfully.");
});

// PATCH /api/events/:id/services/:serviceId  { status }  (progress per service, SRS FR-EVT-09)
const updateService = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Event not found.");
  const serviceId = parseId(req.params.serviceId, "Service not found.");
  await findOwned(id, req.user.id);

  const result = await prisma.eventService.updateMany({
    where: { id: serviceId, eventId: id },
    data: { status: req.body.status },
  });
  if (result.count === 0) throw new AppError("Service not found.", 404);

  const event = await prisma.event.findUnique({ where: { id }, include });
  sendSuccess(res, toEvent(event), "Service progress updated.");
});

const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Event not found.");
  await findOwned(id, req.user.id);

  const activeBookings = await prisma.booking.count({
    where: { eventId: id, status: { not: "CANCELLED" } },
  });
  if (activeBookings > 0) {
    throw new AppError("This event has active bookings. Cancel them first.", 409);
  }

  await prisma.event.delete({ where: { id } });
  sendSuccess(res, null, "Event deleted.", 204);
});

module.exports = { list, getOne, create, update, updateService, remove };