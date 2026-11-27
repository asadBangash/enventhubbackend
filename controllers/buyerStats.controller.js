const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { toNotification } = require("../utils/serializers");
const { money } = require("../utils/helpers");

// GET /api/buyer/stats
const stats = asyncHandler(async (req, res) => {
  const buyerId = req.user.id;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalEvents,
    upcomingEvents,
    pendingRequests,
    quotesReceived,
    activeBookings,
    completedBookings,
    spent,
    unreadNotifications,
    recent,
  ] = await Promise.all([
    prisma.event.count({ where: { buyerId } }),
    prisma.event.count({ where: { buyerId, status: "UPCOMING", eventDate: { gte: startOfToday } } }),
    prisma.serviceRequest.count({ where: { buyerId, status: { in: ["PENDING", "RESPONDED"] } } }),
    prisma.offer.count({ where: { status: "SENT", request: { buyerId } } }),
    prisma.booking.count({ where: { buyerId, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] } } }),
    prisma.booking.count({ where: { buyerId, status: "COMPLETED" } }),
    prisma.payment.aggregate({
      where: { status: "PAID", booking: { buyerId } },
      _sum: { amount: true },
    }),
    prisma.notification.count({ where: { userId: buyerId, isRead: false } }),
    prisma.notification.findMany({ where: { userId: buyerId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  sendSuccess(res, {
    totalEvents,
    upcomingEvents,
    pendingRequests,
    quotesReceived,
    activeBookings,
    completedBookings,
    totalSpent: money(spent._sum.amount),
    unreadNotifications,
    recentActivity: recent.map(toNotification),
  });
});

module.exports = { stats };