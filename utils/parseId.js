const AppError = require("./AppError");

// Turns a URL value like "5" into the number 5, or a 404 if it is not a valid id
module.exports = (value, message = "Not found.") => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(message, 404);
  return id;
};