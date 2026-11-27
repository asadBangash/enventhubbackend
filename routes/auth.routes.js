const express = require("express");
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validators/auth.validator");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), controller.register);
router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), controller.resetPassword);
router.get("/me", authenticate, controller.me);
router.post("/logout", controller.logout);

module.exports = router;