const prisma = require("../config/db");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const { sendSuccess } = require("../utils/apiResponse");
const { toListing } = require("../utils/serializers");
const { listingInclude } = require("../utils/includes");
const { getMonthSlots } = require("../services/availability.service");

const findSeller = async (idParam) => {
  const id = parseId(idParam, "Provider not found.");
  const user = await prisma.user.findFirst({
    where: { id, role: "seller", status: "active" },
    include: { sellerProfile: true },
  });
  if (!user || !user.sellerProfile) throw new AppError("Provider not found.", 404);
  return user;
};

// GET /api/sellers/:id   (:id is the seller's user id, the same as listing.sellerId)
const getProfile = asyncHandler(async (req, res) => {
  const user = await findSeller(req.params.id);
  const p = user.sellerProfile;
    // Count a profile view (every visit counts, including your own)
  prisma.sellerProfile
    .update({ where: { userId: user.id }, data: { profileViews: { increment: 1 } } })
    .catch(() => {});

  const [listings, portfolio, rating] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: user.id, status: "APPROVED" },
      include: listingInclude,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.portfolioItem.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.review.aggregate({
      where: { sellerId: user.id, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  sendSuccess(res, {
    id: user.id,
    businessName: p.businessName,
    description: p.description,
    location: p.location,
    serviceAreas: p.serviceAreas,
    experienceYears: p.experienceYears,
    website: p.website,
    logoUrl: p.logoUrl,
    coverUrl: p.coverUrl,
    isVerified: p.isVerified,
    memberSince: user.createdAt.toISOString(),
    rating: {
      average: rating._avg.rating ? Math.round(rating._avg.rating * 10) / 10 : null,
      count: rating._count,
    },
    services: listings.map(toListing),
    portfolio: portfolio.map((item) => ({
      id: item.id,
      imageUrl: item.imageUrl,
      title: item.title,
      description: item.description,
    })),
  });
});

// GET /api/sellers/:id/availability?month=2027-03
const getAvailability = asyncHandler(async (req, res) => {
  const user = await findSeller(req.params.id);
  sendSuccess(res, await getMonthSlots(user.id, req.query.month));
});

module.exports = { getProfile, getAvailability };