const express = require("express");
const controller = require("../controllers/booking.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { updateBookingStatusSchema } = require("../validators/booking.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("buyer", "seller"), controller.list);
router.get("/:id", authorize("buyer", "seller", "admin"), controller.getOne);
router.patch(
  "/:id/status",
  authorize("buyer", "seller"),
  validate(updateBookingStatusSchema),
  controller.updateStatus
);

module.exports = router;