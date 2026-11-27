const express = require("express");
const controller = require("../controllers/category.controller");

const router = express.Router();

router.get("/", controller.list); // public: visitors can browse (FR-PUB-08)

module.exports = router;