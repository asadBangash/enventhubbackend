require("dotenv").config();

// These values must exist, or the server should not start
const required = ["DATABASE_URL", "JWT_SECRET", "CLIENT_URL"];

required.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required setting in .env: ${name}`);
  }
});

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cookieName: process.env.COOKIE_NAME || "eventhub_token",
  commissionRate: Number(process.env.COMMISSION_RATE) || 0.1,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    currency: (process.env.STRIPE_CURRENCY || "usd").toLowerCase(),
    pkrPerUsd: Number(process.env.STRIPE_PKR_PER_USD) || 280,
  },
};