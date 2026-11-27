const { ZodError, flattenError } = require("zod");
const env = require("../config/env");

module.exports = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong.";
  let errors = err.errors || null;

  // Invalid input (Zod). Frontend reads errors.fieldErrors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Request data is invalid.";
    errors = flattenError(err);
  }

  // Image upload problems (Multer)
  if (err.name === "MulterError") {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be smaller than 5 MB."
        : err.code === "LIMIT_UNEXPECTED_FILE"
        ? 'Send the image in a form field named "file".'
        : "Upload failed.";
  }

  // Prisma: duplicate value (for example, an email that already exists)
  if (err.code === "P2002") {
    statusCode = 409;
    message = "This value already exists.";
  }

  // Prisma: record not found
  if (err.code === "P2025") {
    statusCode = 404;
    message = "Record not found.";
  }

  // Broken JSON sent by the client
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON in request body.";
  }

  // Show the real error in the terminal while developing
  if (statusCode === 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && env.nodeEnv === "production" ? "Something went wrong." : message,
    errors,
  });
};