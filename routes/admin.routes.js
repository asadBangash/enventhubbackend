const express = require("express");
const admin = require("../controllers/admin.controller");
const users = require("../controllers/adminUsers.controller");
const verification = require("../controllers/adminVerification.controller");
const categories = require("../controllers/adminCategories.controller");
const ops = require("../controllers/adminOps.controller");
const finance = require("../controllers/adminFinance.controller");
const payouts = require("../controllers/payout.controller");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { moderateListingSchema } = require("../validators/listing.validator");
const featured = require("../controllers/adminFeatured.controller");
const {
  setUserStatusSchema,
  verificationDecisionSchema,
  createCategorySchema,
  updateCategorySchema,
  moderateReviewSchema,
  resolveDisputeSchema,
} = require("../validators/admin.validator");

const router = express.Router();

// Everything here is admin only (SRS NFR-05)
router.use(authenticate, authorize("admin"));

router.get("/dashboard", admin.dashboard);

// Users and sellers
router.get("/users", users.listUsers);
router.patch("/users/:id/status", validate(setUserStatusSchema), users.setUserStatus);
router.get("/sellers", users.listSellers);

// Seller verification
router.get("/verification", verification.list);
router.get("/verification/:id/document", verification.document);
router.patch("/verification/:id", validate(verificationDecisionSchema), verification.decide);

// Categories
router.get("/categories", categories.list);
router.post("/categories", validate(createCategorySchema), categories.create);
router.patch("/categories/:id", validate(updateCategorySchema), categories.update);
router.delete("/categories/:id", categories.remove);

// Services (listings) and events
router.get("/listings", admin.listListings);
router.patch("/listings/:id/status", validate(moderateListingSchema), admin.moderateListing);
router.patch("/listings/:id/featured", featured.setFeatured);
router.get("/events", ops.listEvents);

// Reviews and disputes
router.get("/reviews", ops.listReviews);
router.patch("/reviews/:id/status", validate(moderateReviewSchema), ops.moderateReview);
router.get("/disputes", ops.listDisputes);
router.patch("/disputes/:id", validate(resolveDisputeSchema), ops.resolveDispute);


// Money
router.get("/bookings", finance.listBookings);
router.get("/payments", finance.listPayments);
router.get("/commissions", finance.listCommissions);
router.get("/reports", finance.reports);
router.get("/payouts", payouts.listAdmin);
router.patch("/payouts/:id", payouts.updateAdmin);

// Admin action history
router.get("/audit-logs", ops.listAuditLogs);

module.exports = router;