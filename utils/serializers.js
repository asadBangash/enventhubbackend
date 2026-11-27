const num = (v) => (v === null || v === undefined ? null : Number(v));
const iso = (d) => (d ? d.toISOString() : null);

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  buyerProfile:
    user.role === "buyer"
      ? {
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          city: user.city,
          organizationName: user.organizationName,
        }
      : null,
  sellerProfile: user.sellerProfile
    ? {
        businessName: user.sellerProfile.businessName,
        location: user.sellerProfile.location,
        isVerified: user.sellerProfile.isVerified,
      }
    : null,
});

const toSellerProfile = (user) => {
  const p = user.sellerProfile;
  return {
    id: p.id,
    userId: user.id,
    email: user.email,
    phone: user.phone,
    businessName: p.businessName,
    contactPerson: p.contactPerson,
    description: p.description,
    location: p.location,
    website: p.website,
    experienceYears: p.experienceYears,
    serviceAreas: p.serviceAreas,
    primaryCategoryId: p.primaryCategoryId,
    logoUrl: p.logoUrl,
    coverUrl: p.coverUrl,
    isVerified: p.isVerified,
    verificationStatus: p.verificationStatus,
  };
};

// rating = { average, count } of the seller, when the caller has it
const toListing = (l, rating) => ({
  id: l.id,
  sellerId: l.sellerId,
  title: l.title,
  description: l.description,
  location: l.location,
  price: Number(l.price),
  currency: l.currency,
  pricingType: l.pricingType,
  features: l.features,
  terms: l.terms,
  status: l.status,
  isFeatured: l.isFeatured,
  category: l.category,
  images: (l.images || []).map((i) => ({ id: i.id, url: i.url, altText: i.altText })),
  packages: (l.packages || []).map((p) => ({
    id: p.id,
    tier: p.tier,
    name: p.name,
    price: Number(p.price),
    inclusions: p.inclusions,
  })),
  rating: rating || { average: null, count: 0 },
  seller: l.seller,
});

// Draft and cancelled events keep their status. Others are worked out from the date.
const eventStatus = (e) => {
  if (e.status !== "UPCOMING" || !e.eventDate) return e.status;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(e.eventDate);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "ONGOING";
  if (day < today) return "COMPLETED";
  return "UPCOMING";
};

const toEvent = (e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  eventDate: iso(e.eventDate),
  eventTime: e.eventTime,
  location: e.location,
  guests: e.guests,
  budget: num(e.budget),
  description: e.description,
  services: (e.services || []).map((s) => s.serviceType),
  serviceItems: (e.services || []).map((s) => ({ id: s.id, name: s.serviceType, status: s.status })),
  status: eventStatus(e),
});

const toOffer = (o) => ({
  id: o.id,
  requestId: o.requestId,
  sellerId: o.sellerId,
  amount: Number(o.amount),
  currency: o.currency,
  description: o.description,
  validUntil: iso(o.validUntil),
  status: o.status,
  seller: o.seller ? { name: o.seller.name } : undefined,
});

const toRequest = (r) => ({
  id: r.id,
  buyerId: r.buyerId,
  sellerId: r.sellerId,
  eventId: r.eventId,
  event: r.event ? toEvent(r.event) : null,
  listing: r.listing ? { id: r.listing.id, title: r.listing.title } : null,
  title: r.title,
  eventDate: iso(r.eventDate),
  location: r.location,
  minBudget: num(r.minBudget),
  maxBudget: num(r.maxBudget),
  details: r.details,
  status: r.status,
  createdAt: iso(r.createdAt),
  buyer: r.buyer ? { id: r.buyer.id, name: r.buyer.name } : undefined,
  offers: r.offers ? r.offers.map(toOffer) : undefined,
});

const toBooking = (b, viewerRole = "buyer") => ({
  id: b.id,
  buyerId: b.buyerId,
  sellerId: b.sellerId,
  listingId: b.listingId,
  eventId: b.eventId,
  eventDate: iso(b.eventDate),
  amount: Number(b.amount),
  currency: b.currency,
  status: b.status,
  note: b.note,
  notes: b.note,
  createdAt: iso(b.createdAt),
  platformFee: b.payment ? Number(b.payment.buyerFee) : 0,
  payment: b.payment
    ? {
        id: b.payment.id,
        method: b.payment.method,
        amount: Number(b.payment.amount),
        buyerFee: Number(b.payment.buyerFee),
        status: b.payment.status,
      }
    : null,
  // Commission is visible to the seller and admin only (SRS FR-REV-04)
  ...(b.commission && viewerRole !== "buyer"
    ? {
        commission: {
          rate: Number(b.commission.rate),
          amount: Number(b.commission.amount),
          sellerNet: Number(b.commission.sellerNet),
        },
      }
    : {}),
  listing: b.listing || null,
  buyer: b.buyer,
  seller: b.seller,
});

const toReview = (r) => ({
  id: r.id,
  bookingId: r.bookingId,
  sellerId: r.sellerId,
  rating: r.rating,
  comment: r.comment,
  createdAt: iso(r.createdAt),
  buyer: r.buyer ? { id: r.buyer.id, name: r.buyer.name } : undefined,
});

// Conversations are always between one buyer and one seller
const toConversation = (c) => {
  const buyer = c.userA.role === "buyer" ? c.userA : c.userB;
  const seller = c.userA.role === "seller" ? c.userA : c.userB;
  return {
    id: c.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    buyer: { id: buyer.id, name: buyer.name },
    seller: { id: seller.id, name: seller.name },
    messages: (c.messages || []).map((m) => ({ body: m.body, createdAt: iso(m.createdAt) })),
  };
};

const toMessage = (m) => ({
  id: m.id,
  conversationId: m.conversationId,
  sender: { id: m.sender.id, name: m.sender.name },
  body: m.body,
  readAt: iso(m.readAt),
  createdAt: iso(m.createdAt),
});

const toNotification = (n) => ({
  id: n.id,
  type: n.type,
  text: n.text,
  isRead: n.isRead,
  createdAt: iso(n.createdAt),
});

module.exports = {
  toPublicUser,
  toSellerProfile,
  toListing,
  toEvent,
  toOffer,
  toRequest,
  toBooking,
  toReview,
  toConversation,
  toMessage,
  toNotification,
};