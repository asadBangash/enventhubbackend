const express = require("express");
const controller = require("../controllers/request.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { createRequestSchema, offerSchema } = require("../validators/request.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("buyer", "seller"), controller.list);
router.post("/", authorize("buyer"), validate(createRequestSchema), controller.create);
router.post("/:id/offers", authorize("seller"), validate(offerSchema), controller.sendOffer);
router.post("/:id/decline", authorize("seller"), controller.decline);

module.exports = router;