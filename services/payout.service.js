const prisma = require("../config/db");

const paidSellerNet = async (sellerId, tx = prisma) => {
  const rows = await tx.commission.findMany({
    where: { booking: { sellerId, payment: { status: "PAID" } } },
    select: { sellerNet: true },
  });
  return rows.reduce((sum, r) => sum + Number(r.sellerNet), 0);
};

const reservedPayouts = async (sellerId, tx = prisma) => {
  const rows = await tx.payoutRequest.findMany({
    where: { sellerId, status: { in: ["PENDING", "APPROVED", "PAID"] } },
    select: { amount: true },
  });
  return rows.reduce((sum, r) => sum + Number(r.amount), 0);
};

const availableBalance = async (sellerId, tx = prisma) => {
  const earned = await paidSellerNet(sellerId, tx);
  const reserved = await reservedPayouts(sellerId, tx);
  return Math.round((earned - reserved) * 100) / 100;
};

module.exports = { paidSellerNet, reservedPayouts, availableBalance };