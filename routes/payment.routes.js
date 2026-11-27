const express = require("express");
const controller = require("../controllers/payment.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { createPaymentSchema, checkoutPaymentSchema, confirmSessionSchema } = require("../validators/booking.validator");

const router = express.Router();

router.get("/config", authenticate, authorize("buyer", "seller", "admin"), controller.config);

router.post(
  "/checkout",
  authenticate,
  authorize("buyer"),
  validate(checkoutPaymentSchema),
  controller.createCheckout
);

router.post(
  "/confirm-session",
  authenticate,
  authorize("buyer"),
  validate(confirmSessionSchema),
  controller.confirmSession
);

router.post("/", authenticate, authorize("buyer"), validate(createPaymentSchema), controller.createDemo);

module.exports = router;