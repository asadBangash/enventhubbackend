const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { signToken, setAuthCookie, clearAuthCookie } = require("../utils/jwt");
const { toPublicUser } = require("../utils/serializers");
const { sendPasswordResetEmail, isConfigured: isEmailConfigured } = require("../services/email.service");

const register = asyncHandler(async (req, res) => {
  const {
    name, email, password, role,
    phone, city, organizationName,
    businessName, contactPerson, description, experienceYears, website, serviceAreas, primaryCategoryId,
  } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("An account with this email already exists.", 409);
  }

  if (primaryCategoryId !== undefined) {
    if (role !== "seller") throw new AppError("Only sellers can choose a primary category.", 400);
    const category = await prisma.category.findUnique({ where: { id: primaryCategoryId } });
    if (!category || category.type !== "service") {
      throw new AppError("Invalid service category.", 400);
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      phone: phone ?? null,
      city: city ?? null,
      organizationName: role === "buyer" ? organizationName ?? null : null,
      ...(role === "seller" && {
        sellerProfile: {
          create: {
            businessName: businessName || name,
            contactPerson: contactPerson ?? null,
            description: description ?? null,
            experienceYears: experienceYears ?? null,
            website: website ?? null,
            serviceAreas: serviceAreas ?? null,
            location: city ?? null,
            primaryCategoryId: primaryCategoryId ?? null,
          },
        },
      }),
    },
    include: { sellerProfile: true },
  });

  setAuthCookie(res, signToken(user));
  sendSuccess(res, toPublicUser(user), "Account created successfully.", 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { sellerProfile: true },
  });

  // Same message for wrong email or wrong password, so attackers learn nothing
  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordOk) throw new AppError("Invalid email or password.", 401);

  if (user.status !== "active") {
    throw new AppError("This account is suspended.", 403);
  }

  setAuthCookie(res, signToken(user, rememberMe), rememberMe);
  sendSuccess(res, toPublicUser(user), "Logged in successfully.");
});

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, toPublicUser(req.user));
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, null, "Logged out successfully.");
});

// POST /api/auth/forgot-password  { email }
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!isEmailConfigured()) {
    throw new AppError("Password reset email is not configured.", 503);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === "active") {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      }),
    ]);

    try {
      await sendPasswordResetEmail(user.email, user.name, token);
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
      throw error;
    }
  }

  // The same answer whether or not the e-mail exists
  sendSuccess(res, null, "If this e-mail is registered, a reset link has been sent.");
});

// POST /api/auth/reset-password  { token, newPassword }
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("This reset link is invalid or has expired.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    // Only one request can use the token
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new AppError("This reset link is invalid or has expired.", 400);
    }
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
  });

  sendSuccess(res, null, "Password reset. You can log in now.");
});

module.exports = { register, login, me, logout, forgotPassword, resetPassword };