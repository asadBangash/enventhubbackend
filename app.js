const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const routes = require("./routes");
const path = require("path");

const app = express();

// Security headers (cross-origin allowed so the frontend can show uploaded images later)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: only your frontend may call the API, and cookies are allowed.
// The frontend uses credentials: "include", so a plain cors() would fail.
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

// Stripe webhook must receive the raw body for signature verification
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => require("./controllers/payment.controller").handleWebhook(req, res).catch(next)
);

// Read JSON bodies and cookies
app.use(express.json());
app.use(cookieParser());

// Only these image folders are public. The "verification" folder (ID documents) never is.
["avatars", "listings", "portfolio"].forEach((folder) => {
  app.use(
    `/uploads/${folder}`,
    express.static(path.join(__dirname, "uploads", folder), { index: false })
  );
});

// Print every request in the terminal while developing
if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// Your original test route
app.get("/", (req, res) => {
  res.send("FYP Backend is running successfully!");
});

// Health check, in the same format the frontend expects:
// { success, data, message }
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "ok", time: new Date().toISOString() },
    message: "EventHub API is healthy.",
  });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);


module.exports = app;