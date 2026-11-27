const express = require("express");
const controller = require("../controllers/payout.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get("/balance", authorize("seller"), controller.balance);
router.get("/", authorize("seller"), controller.listMine);
router.post("/", authorize("seller"), controller.create);

module.exports = router;