const express = require("express");
const controller = require("../controllers/seller.controller");
const portfolio = require("../controllers/portfolio.controller");
const availability = require("../controllers/availability.controller");
const stats = require("../controllers/sellerStats.controller");
const quotations = require("../controllers/sellerQuotations.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { uploadImage } = require("../middleware/upload");
const {
  updateSellerProfileSchema,
  setAvailabilitySchema,
} = require("../validators/seller.validator");

const router = express.Router();

// Everything here needs a logged-in seller
router.use(authenticate, authorize("seller"));

router.get("/profile", controller.getProfile);
router.patch("/profile", validate(updateSellerProfileSchema), controller.updateProfile);

router.get("/stats", stats.stats);
router.get("/earnings", stats.earnings);
router.get("/quotations", quotations.list);

router.get("/portfolio", portfolio.list);
router.post("/portfolio", uploadImage("portfolio"), portfolio.create);
router.delete("/portfolio/:id", portfolio.remove);

router.get("/availability", availability.list);
router.put("/availability", validate(setAvailabilitySchema), availability.set);

module.exports = router;