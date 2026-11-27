const listingInclude = {
  category: { select: { id: true, name: true, slug: true } },
  seller: {
    select: {
      id: true,
      name: true,
      sellerProfile: { select: { businessName: true, location: true, isVerified: true } },
    },
  },
  images: { orderBy: { sortOrder: "asc" } },
  packages: { orderBy: { tier: "asc" } },
};

const requestInclude = {
  listing: { select: { id: true, title: true } },
  buyer: { select: { id: true, name: true } },
  event: { include: { services: true } },
  offers: {
    include: { seller: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  },
};

const bookingInclude = {
  listing: { select: { id: true, title: true, location: true } },
  buyer: { select: { id: true, name: true } },
  seller: {
    select: { id: true, name: true, sellerProfile: { select: { businessName: true } } },
  },
  payment: true,
  commission: true,
};

module.exports = { listingInclude, requestInclude, bookingInclude };