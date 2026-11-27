const express = require("express");
const controller = require("../controllers/paymentMethod.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate, authorize("buyer", "seller"));

router.get("/", controller.list);
router.post("/stripe-setup", authorize("buyer"), controller.createStripeSetup);
router.post("/payout", authorize("seller"), controller.addPayoutMethod);
router.delete("/:id", controller.remove);

module.exports = router;