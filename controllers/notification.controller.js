const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toNotification } = require("../utils/serializers");

// GET /api/notifications
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 30);
  const where = { userId: req.user.id };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);

  const result = buildPage(items.map(toNotification), total, page, pageSize);
  result.unreadCount = unreadCount;
  sendSuccess(res, result);
});

// PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Notification not found.");
  const result = await prisma.notification.updateMany({
    where: { id, userId: req.user.id },
    data: { isRead: true },
  });
  if (result.count === 0) throw new AppError("Notification not found.", 404);
  sendSuccess(res, null, "Marked as read.");
});

// POST /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  sendSuccess(res, null, "All notifications marked as read.");
});

module.exports = { list, markRead, markAllRead };