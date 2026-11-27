const express = require("express");
const controller = require("../controllers/buyerStats.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate, authorize("buyer"));

router.get("/stats", controller.stats);

module.exports = router;