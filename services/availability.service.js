const prisma = require("../config/db");

// "2027-03" -> start and end of that month (UTC). No month = current month.
const monthRange = (month) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month || "");
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const mon = match ? Number(match[2]) : now.getUTCMonth() + 1;
  return {
    label: `${year}-${String(mon).padStart(2, "0")}`,
    start: new Date(Date.UTC(year, mon - 1, 1)),
    end: new Date(Date.UTC(year, mon, 1)),
  };
};

// Dates with no row are AVAILABLE by default
const getMonthSlots = async (sellerId, month) => {
  const { label, start, end } = monthRange(month);
  const slots = await prisma.availabilitySlot.findMany({
    where: { sellerId, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
  return {
    month: label,
    slots: slots.map((s) => ({ date: s.date.toISOString().slice(0, 10), state: s.state })),
  };
};

module.exports = { monthRange, getMonthSlots };