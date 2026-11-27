const express = require("express");
const controller = require("../controllers/verification.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { uploadImage } = require("../middleware/upload");
const { submitVerificationSchema } = require("../validators/verification.validator");

const router = express.Router();

router.use(authenticate, authorize("seller"));

router.get("/", controller.list);
router.post("/documents", uploadImage("verification"), controller.uploadDocument);
router.post("/", validate(submitVerificationSchema), controller.submit);

module.exports = router;