const express = require("express");
const controller = require("../controllers/dispute.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { createDisputeSchema } = require("../validators/dispute.validator");

const router = express.Router();

router.use(authenticate, authorize("buyer", "seller"));

router.get("/", controller.list);
router.post("/", validate(createDisputeSchema), controller.create);

module.exports = router;