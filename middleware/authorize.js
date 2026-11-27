const AppError = require("../utils/AppError");

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new AppError("You do not have permission to do this.", 403);
  }
  next();
};

module.exports = authorize;