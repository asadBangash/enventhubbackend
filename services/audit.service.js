const prisma = require("../config/db");

// Records an admin action (SRS NFR-15). Pass "tx" to use it inside a transaction.
const logAction = (adminId, action, entity, entityId = null, details = null, db = prisma) =>
  db.auditLog.create({ data: { adminId, action, entity, entityId, details } });

module.exports = { logAction };