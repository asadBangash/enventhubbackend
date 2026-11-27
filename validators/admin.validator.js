const { z } = require("zod");

const setUserStatusSchema = z.object({
  status: z.enum(["active", "suspended"], { message: "Status must be active or suspended." }),
});

const verificationDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"], { message: "Decision must be approved or rejected." }),
    reviewNote: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision === "approved" || (d.reviewNote && d.reviewNote.length >= 3), {
    message: "Please explain why the request was rejected.",
    path: ["reviewNote"],
  });

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
  type: z.enum(["service", "event"], { message: "Type must be service or event." }),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
});

const moderateReviewSchema = z.object({
  status: z.enum(["PUBLISHED", "REMOVED"], { message: "Status must be PUBLISHED or REMOVED." }),
});

const resolveDisputeSchema = z.object({
  status: z.enum(["RESOLVED", "REJECTED"], { message: "Status must be RESOLVED or REJECTED." }),
  resolution: z.string().trim().min(5, "Please explain the decision.").max(2000),
});

module.exports = {
  setUserStatusSchema,
  verificationDecisionSchema,
  createCategorySchema,
  updateCategorySchema,
  moderateReviewSchema,
  resolveDisputeSchema,
};