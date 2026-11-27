// Returns the value only if it is one of the allowed values (stops bad filters crashing queries)
const oneOf = (value, allowed) => (allowed.includes(value) ? value : undefined);

// Rounds money to 2 decimals
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

// Business name for sellers, normal name otherwise
const sellerName = (user) =>
  (user && user.sellerProfile && user.sellerProfile.businessName) || (user && user.name) || null;

module.exports = { oneOf, money, sellerName };