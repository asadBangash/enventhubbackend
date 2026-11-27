const express = require("express");
const controller = require("../controllers/message.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { sendMessageSchema } = require("../validators/message.validator");

const router = express.Router();

router.use(authenticate, authorize("buyer", "seller"));

router.get("/", controller.list);
router.post("/", validate(sendMessageSchema), controller.send);

module.exports = router;