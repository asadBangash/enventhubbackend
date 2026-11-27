const jwt = require("jsonwebtoken");
const env = require("../config/env");

const DAY = 24 * 60 * 60 * 1000;

// rememberMe true -> 30 days. false -> 1 day and a session cookie. Not sent -> the default from .env.
const signToken = (user, rememberMe) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: rememberMe === true ? "30d" : rememberMe === false ? "1d" : env.jwtExpiresIn,
  });

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.nodeEnv === "production", // true only when using HTTPS
  path: "/",
};

const setAuthCookie = (res, token, rememberMe) => {
  const options = { ...baseCookieOptions };
  if (rememberMe === true) options.maxAge = 30 * DAY;
  else if (rememberMe === undefined) options.maxAge = 7 * DAY;
  // rememberMe === false: no maxAge, so the cookie ends when the browser closes
  res.cookie(env.cookieName, token, options);
};

const clearAuthCookie = (res) => {
  res.clearCookie(env.cookieName, baseCookieOptions);
};

module.exports = { signToken, setAuthCookie, clearAuthCookie };