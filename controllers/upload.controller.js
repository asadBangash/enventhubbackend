const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

// POST /api/uploads  (form field "file"). Saves an avatar or logo image and returns its URL.
const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { url: req.fileUrl }, "Image uploaded.", 201);
});

module.exports = { create };