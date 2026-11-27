const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");

module.exports = asyncHandler(async (req, res, next) => {
  const token = req.cookies[env.cookieName];

  if (token) {
    let payload = null;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      payload = null; // bad or expired token: treat as a visitor
    }

    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        include: { sellerProfile: true },
      });
      if (user && user.status === "active") req.user = user;
    }
  }

  next();
});