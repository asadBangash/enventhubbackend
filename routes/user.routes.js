const express = require("express");
const controller = require("../controllers/user.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const { updateMeSchema, changePasswordSchema } = require("../validators/user.validator");

const router = express.Router();

router.use(authenticate);

router.get("/me", controller.getMe);
router.patch("/me", validate(updateMeSchema), controller.updateMe);
router.patch("/me/password", validate(changePasswordSchema), controller.changePassword);

module.exports = router;