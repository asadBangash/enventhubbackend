const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

module.exports = asyncHandler(async (req, res, next) => {
  const token = req.cookies[env.cookieName];
  if (!token) throw new AppError("Please log in to continue.", 401);

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError("Your session has expired. Please log in again.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { sellerProfile: true },
  });

  if (!user) throw new AppError("Account not found.", 401);
  if (user.status !== "active") throw new AppError("This account is suspended.", 403);

  req.user = user;
  next();
});