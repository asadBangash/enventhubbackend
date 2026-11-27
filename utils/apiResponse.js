const sendSuccess = (res, data = null, message = "OK", statusCode = 200) => {
  // 204 means "no content", so the frontend expects an empty body
  if (statusCode === 204) return res.status(204).send();
  return res.status(statusCode).json({ success: true, data, message });
};

module.exports = { sendSuccess };