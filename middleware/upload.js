const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const AppError = require("../utils/AppError");
const { UPLOAD_ROOT } = require("../utils/files");

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// Reads the first bytes of the file to confirm it really is an image
const verifyImage = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please choose an image (form field name: "file").', 400));
  }

  const fd = fs.openSync(req.file.path, "r");
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isWebp = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";

  if (!isJpg && !isPng && !isWebp) {
    fs.unlinkSync(req.file.path);
    return next(new AppError("This file is not a valid image.", 400));
  }

  req.fileUrl = `/uploads/${path.basename(path.dirname(req.file.path))}/${req.file.filename}`;
  next();
};

// Use in routes as: router.post("/", uploadImage("listings"), controller)
const uploadImage = (folder) => [
  multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(UPLOAD_ROOT, folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT[file.mimetype]),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) =>
      EXT[file.mimetype]
        ? cb(null, true)
        : cb(new AppError("Only JPG, PNG or WebP images are allowed.", 400)),
  }).single("file"),
  verifyImage,
];

module.exports = { uploadImage };