const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { notify } = require("../services/notification.service");

const toVerification = (v) => ({
  id: v.id,
  documentType: v.documentType,
  hasDocument: Boolean(v.documentUrl), // the file path itself is never shown
  note: v.note,
  status: v.status,
  reviewNote: v.reviewNote,
  createdAt: v.createdAt.toISOString(),
});

// GET /api/verification  (my requests)
const list = asyncHandler(async (req, res) => {
  const items = await prisma.verificationRequest.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(res, items.map(toVerification));
});

// POST /api/verification/documents  (multipart, field "file")
const uploadDocument = asyncHandler(async (req, res) => {
  sendSuccess(res, { url: req.fileUrl }, "Document uploaded.", 201);
});

// POST /api/verification  (documents are optional in the prototype, SRS FR-AUTH-04)
const submit = asyncHandler(async (req, res) => {
  const profile = req.user.sellerProfile;
  if (!profile) throw new AppError("Seller profile not found.", 404);

  if (profile.isVerified || profile.verificationStatus === "approved") {
    throw new AppError("Your business is already verified.", 409);
  }

  const pending = await prisma.verificationRequest.count({
    where: { userId: req.user.id, status: "submitted" },
  });
  if (pending > 0) {
    throw new AppError("Your verification request is already under review.", 409);
  }

  const { documentType, documentUrl, note } = req.body;

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.verificationRequest.create({
      data: {
        userId: req.user.id,
        documentType: documentType || "PROFILE_ONLY",
        documentUrl: documentUrl ?? null,
        note: note ?? null,
      },
    });

    await tx.sellerProfile.update({
      where: { userId: req.user.id },
      data: { verificationStatus: "submitted" },
    });

    const admins = await tx.user.findMany({
      where: { role: "admin", status: "active" },
      select: { id: true },
    });
    for (const admin of admins) {
      await notify(admin.id, "verification", `${profile.businessName} requested verification.`, tx);
    }

    return created;
  });

  sendSuccess(res, toVerification(request), "Verification request submitted.", 201);
});

module.exports = { list, uploadDocument, submit };