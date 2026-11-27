const express = require("express");
const controller = require("../controllers/review.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { createReviewSchema } = require("../validators/review.validator");

const router = express.Router();

router.get("/", controller.list); // public: visitors can read reviews
router.post("/", authenticate, authorize("buyer"), validate(createReviewSchema), controller.create);

module.exports = router;