const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const AppError = require("../utils/AppError");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: env.nodeEnv === "production" ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(new AppError("Too many attempts. Please try again later.", 429)),
});

module.exports = { authLimiter };