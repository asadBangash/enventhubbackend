const express = require("express");

const router = express.Router();

router.use("/auth", require("./auth.routes"));
router.use("/categories", require("./category.routes"));
router.use("/seller", require("./seller.routes"));
router.use("/listings", require("./listing.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/events", require("./event.routes"));
router.use("/requests", require("./request.routes"));
router.use("/offers", require("./offer.routes"));
router.use("/bookings", require("./booking.routes"));
router.use("/payments", require("./payment.routes"));
router.use("/payment-methods", require("./paymentMethod.routes"));
router.use("/payouts", require("./payout.routes"));
router.use("/reviews", require("./review.routes"));
router.use("/messages", require("./message.routes"));
router.use("/notifications", require("./notification.routes"));
router.use("/verification", require("./verification.routes"));
router.use("/disputes", require("./dispute.routes"));
router.use("/sellers", require("./publicSeller.routes"));
router.use("/buyer", require("./buyer.routes"));
module.exports = router;