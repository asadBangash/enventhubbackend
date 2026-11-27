const express = require("express");
const controller = require("../controllers/event.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const {
  createEventSchema,
  updateEventSchema,
  serviceStatusSchema,
} = require("../validators/event.validator");

const router = express.Router();

router.use(authenticate, authorize("buyer"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", validate(createEventSchema), controller.create);
router.patch("/:id", validate(updateEventSchema), controller.update);
router.patch("/:id/services/:serviceId", validate(serviceStatusSchema), controller.updateService);
router.delete("/:id", controller.remove);

module.exports = router;