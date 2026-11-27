const { z } = require("zod");

const sendMessageSchema = z.object({
  recipientId: z.coerce.number().int().positive("Recipient is required."),
  body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
});

module.exports = { sendMessageSchema };