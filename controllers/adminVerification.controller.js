const path = require("path");
const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { getPagination, buildPage } = require("../utils/pagination");
const { oneOf } = require("../utils/helpers");
const { UPLOAD_ROOT } = require("../utils/files");
const { logAction } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

// GET /api/admin/verification?status=submitted  (FR-ADM-04)
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query, 20);
  const status = oneOf(req.query.status, ["submitted", "approved", "rejected"]);
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.verificationRequest.findMany({
      where,
      include: { user: { include: { sellerProfile: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.verificationRequest.count({ where }),
  ]);

  const items = rows.map((v) => ({
    id: v.id,
    sellerId: v.userId,
    business: v.user.sellerProfile ? v.user.sellerProfile.businessName : null,
    owner: v.user.name,
    location: v.user.sellerProfile ? v.user.sellerProfile.location : null,
    documentType: v.documentType,
    hasDocument: Boolean(v.documentUrl),
    note: v.note,
    status: v.status,
    reviewNote: v.reviewNote,
    submitted: v.createdAt.toISOString(),
  }));

  sendSuccess(res, buildPage(items, total, page, pageSize));
});

// GET /api/admin/verification/:id/document  (private file, admin only)
const document = asyncHandler(async (req, res, next) => {
  const id = parseId(req.params.id, "Verification request not found.");
  const request = await prisma.verificationRequest.findUnique({ where: { id } });
  if (!request || !request.documentUrl) throw new AppError("No document attached.", 404);

  const folder = path.join(UPLOAD_ROOT, "verification");
  const full = path.resolve(UPLOAD_ROOT, request.documentUrl.slice("/uploads/".length));
  if (!full.startsWith(folder + path.sep)) throw new AppError("Document not found.", 404);

  await logAction(req.user.id, "VERIFICATION_DOCUMENT_VIEWED", "VerificationRequest", id);
  res.sendFile(full, (err) => {
    if (err) next(new AppError("Document not found.", 404));
  });
});

// PATCH /api/admin/verification/:id  { decision: "approved" | "rejected", reviewNote }
const decide = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "Verification request not found.");
  const { decision, reviewNote } = req.body;

  const request = await prisma.verificationRequest.findUnique({ where: { id } });
  if (!request) throw new AppError("Verification request not found.", 404);

  await prisma.$transaction(async (tx) => {
    // Only one decision can win
    const claimed = await tx.verificationRequest.updateMany({
      where: { id, status: "submitted" },
      data: { status: decision, reviewedById: req.user.id, reviewNote: reviewNote ?? null },
    });
    if (claimed.count === 0) throw new AppError("This request was already reviewed.", 409);

    await tx.sellerProfile.update({
      where: { userId: request.userId },
      data: { verificationStatus: decision, isVerified: decision === "approved" },
    });

    await notify(
      request.userId,
      "verification",
      decision === "approved"
        ? "Congratulations! Your business is now verified."
        : "Your verification request was rejected. Check the note and try again.",
      tx
    );
    await logAction(req.user.id, `VERIFICATION_${decision.toUpperCase()}`, "VerificationRequest", id, null, tx);
  });

  sendSuccess(res, { id, status: decision }, `Verification ${decision}.`);
});

module.exports = { list, document, decide };