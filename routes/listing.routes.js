const express = require("express");
const controller = require("../controllers/listing.controller");
const media = require("../controllers/listingMedia.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const optionalAuth = require("../middleware/optionalAuth");
const ownListing = require("../middleware/ownListing");
const { uploadImage } = require("../middleware/upload");
const { createListingSchema, updateListingSchema } = require("../validators/listing.validator");
const { setPackagesSchema } = require("../validators/package.validator");

const router = express.Router();

// Public (optionalAuth lets owners see their own drafts)
router.get("/", optionalAuth, controller.list);
router.get("/:id", optionalAuth, controller.getOne);

// Seller only
router.post("/", authenticate, authorize("seller"), validate(createListingSchema), controller.create);
router.patch("/:id", authenticate, authorize("seller"), validate(updateListingSchema), controller.update);
router.delete("/:id", authenticate, authorize("seller"), controller.archive);

// Packages and images of a service (ownListing runs BEFORE the upload is accepted)
router.put(
  "/:id/packages",
  authenticate,
  authorize("seller"),
  ownListing,
  validate(setPackagesSchema),
  media.setPackages
);
router.post(
  "/:id/images",
  authenticate,
  authorize("seller"),
  ownListing,
  uploadImage("listings"),
  media.addImage
);
router.delete("/:id/images/:imageId", authenticate, authorize("seller"), ownListing, media.removeImage);

module.exports = router;