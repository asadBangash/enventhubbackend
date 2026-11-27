const express = require("express");
const controller = require("../controllers/notification.controller");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.use(authenticate);

router.get("/", controller.list);
router.post("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

module.exports = router;