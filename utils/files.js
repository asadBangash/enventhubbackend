const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

// Deletes a file we saved earlier. It can never delete outside the uploads folder.
// We only call this with URLs our own upload code created, never with URLs typed by users.
const removeUploadedFile = (url) => {
  if (!url || !url.startsWith("/uploads/")) return;
  const full = path.resolve(UPLOAD_ROOT, url.slice("/uploads/".length));
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) return;
  fs.unlink(full, () => {});
};

module.exports = { UPLOAD_ROOT, removeUploadedFile };