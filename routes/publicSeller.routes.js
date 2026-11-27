const express = require("express");
const controller = require("../controllers/publicSeller.controller");

const router = express.Router();

// Public: visitors can view provider profiles (SRS FR-PUB-06, FR-PUB-08)
router.get("/:id", controller.getProfile);
router.get("/:id/availability", controller.getAvailability);

module.exports = router;