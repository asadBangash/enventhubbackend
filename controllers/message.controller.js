const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { toConversation, toMessage } = require("../utils/serializers");
const { notify } = require("../services/notification.service");

const person = { select: { id: true, name: true, role: true } };

// GET /api/messages                       -> my conversations
// GET /api/messages?conversationId=1      -> messages of one conversation
const list = asyncHandler(async (req, res) => {
  const me = req.user.id;
  const { page, pageSize, skip, take } = getPagination(req.query, 100);

  if (req.query.conversationId) {
    const id = parseId(req.query.conversationId, "Conversation not found.");
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || (conversation.userAId !== me && conversation.userBId !== me)) {
      throw new AppError("Conversation not found.", 404);
    }

    const where = { conversationId: id };
    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        skip,
        take,
      }),
      prisma.message.count({ where }),
    ]);

    // Opening the chat marks the other person's messages as read
    await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    });

    return sendSuccess(res, buildPage(items.map(toMessage), total, page, pageSize));
  }

  const where = { OR: [{ userAId: me }, { userBId: me }] };
  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        userA: person,
        userB: person,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    prisma.conversation.count({ where }),
  ]);

  sendSuccess(res, buildPage(items.map(toConversation), total, page, pageSize));
});

// POST /api/messages  { recipientId, body }
const send = asyncHandler(async (req, res) => {
  const me = req.user;
  const { recipientId, body } = req.body;

  if (recipientId === me.id) throw new AppError("You cannot message yourself.", 400);

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  const oppositeRole = me.role === "buyer" ? "seller" : "buyer";
  if (!recipient || recipient.status !== "active" || recipient.role !== oppositeRole) {
    throw new AppError("You can only message " + oppositeRole + "s.", 400);
  }

  const [userAId, userBId] = [me.id, recipient.id].sort((a, b) => a - b);
  const existing = await prisma.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });

  // A seller may only reply to buyers who contacted them (SRS NFR-07)
  if (me.role === "seller" && !existing) {
    const linked = await prisma.serviceRequest.count({
      where: { sellerId: me.id, buyerId: recipient.id },
    });
    if (linked === 0) {
      throw new AppError("You can only message buyers who contacted you.", 403);
    }
  }

  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: { updatedAt: new Date() },
    create: { userAId, userBId },
  });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: me.id, body },
    include: { sender: { select: { id: true, name: true } } },
  });

  await notify(recipient.id, "message", `New message from ${me.name}`);
  sendSuccess(res, toMessage(message), "Message sent.", 201);
});

module.exports = { list, send };