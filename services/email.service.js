const nodemailer = require("nodemailer");
const env = require("../config/env");

const isConfigured = () => {
  const hasUser = Boolean(env.smtp.user);
  const hasPassword = Boolean(env.smtp.password);
  return Boolean(
    env.smtp.host &&
      env.smtp.port &&
      env.smtp.from &&
      hasUser === hasPassword
  );
};

const sendPasswordResetEmail = async (email, name, token) => {
  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure || env.smtp.port === 465,
    ...(env.smtp.user && env.smtp.password
      ? { auth: { user: env.smtp.user, pass: env.smtp.password } }
      : {}),
  });
  const resetUrl = new URL("/reset-password", env.clientUrl);
  resetUrl.searchParams.set("token", token);
  const safeName = name.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

  await transporter.sendMail({
    from: env.smtp.from,
    to: email,
    subject: "Reset your EventHub password",
    text: `Hello ${name},\n\nUse this link to reset your EventHub password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Use the link below to reset your EventHub password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
};

module.exports = { isConfigured, sendPasswordResetEmail };
