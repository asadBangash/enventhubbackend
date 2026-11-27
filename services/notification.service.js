const prisma = require("../config/db");

// Creates an in-app notification (FR-BCM-02). Pass "tx" to use it inside a transaction.
const notify = (userId, type, text, db = prisma) =>
  db.notification.create({ data: { userId, type, text } });

module.exports = { notify };