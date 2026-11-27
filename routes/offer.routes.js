const express = require("express");
const controller = require("../controllers/offer.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate, authorize("buyer"));

router.post("/:id/accept", controller.accept);
router.post("/:id/decline", controller.decline);

module.exports = router;