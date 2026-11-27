const env = require("../config/env");

const DAY = 24 * 60 * 60 * 1000;
const dayStart = (date) => new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");

// Marks the seller's calendar date as BOOKED
const markSlotBooked = async (tx, sellerId, eventDate) => {
  if (!eventDate) return;
  const date = dayStart(eventDate);
  await tx.availabilitySlot.upsert({
    where: { sellerId_date: { sellerId, date } },
    update: { state: "BOOKED" },
    create: { sellerId, date, state: "BOOKED" },
  });
};

// Frees the date again, unless the seller has another active booking that day
const releaseSlot = async (tx, booking) => {
  if (!booking.eventDate) return;
  const start = dayStart(booking.eventDate);

  const others = await tx.booking.count({
    where: {
      sellerId: booking.sellerId,
      id: { not: booking.id },
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      eventDate: { gte: start, lt: new Date(start.getTime() + DAY) },
    },
  });

  if (others === 0) {
    await tx.availabilitySlot.deleteMany({
      where: { sellerId: booking.sellerId, date: start, state: "BOOKED" },
    });
  }
};

// Commission is charged to the seller. Net earnings = amount - commission.
const createCommission = (tx, booking) => {
  const rate = env.commissionRate;
  const amount = Math.round(Number(booking.amount) * rate * 100) / 100;
  const sellerNet = Math.round((Number(booking.amount) - amount) * 100) / 100;
  return tx.commission.create({
    data: { bookingId: booking.id, rate, amount, sellerNet },
  });
};

module.exports = { markSlotBooked, releaseSlot, createCommission };