const express = require("express");
const controller = require("../controllers/upload.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { uploadImage } = require("../middleware/upload");

const router = express.Router();

router.post("/", authenticate, authorize("buyer", "seller"), uploadImage("avatars"), controller.create);

module.exports = router;