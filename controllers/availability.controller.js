const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getMonthSlots } = require("../services/availability.service");

const toDate = (s) => new Date(s + "T00:00:00.000Z");

// GET /api/seller/availability?month=2027-03
const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await getMonthSlots(req.user.id, req.query.month));
});

// PUT /api/seller/availability  { dates: ["2027-03-20"], state: "UNAVAILABLE" | "AVAILABLE" }
// Booked dates belong to bookings and are never changed here.
const set = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const dates = [...new Set(req.body.dates)];
  const { state } = req.body;

  const booked = await prisma.availabilitySlot.findMany({
    where: { sellerId, date: { in: dates.map(toDate) }, state: "BOOKED" },
  });
  const bookedSet = new Set(booked.map((s) => s.date.toISOString().slice(0, 10)));
  const targets = dates.filter((d) => !bookedSet.has(d));

  if (state === "UNAVAILABLE") {
    await prisma.$transaction(
      targets.map((d) =>
        prisma.availabilitySlot.upsert({
          where: { sellerId_date: { sellerId, date: toDate(d) } },
          update: { state: "UNAVAILABLE" },
          create: { sellerId, date: toDate(d), state: "UNAVAILABLE" },
        })
      )
    );
  } else {
    await prisma.availabilitySlot.deleteMany({
      where: { sellerId, date: { in: targets.map(toDate) }, state: "UNAVAILABLE" },
    });
  }

  sendSuccess(res, { updated: targets.length, skipped: [...bookedSet] }, "Availability updated.");
});

module.exports = { list, set };