'use strict';

// Configures Multer so uploaded videos are stored on disk with a safe filename.
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const ApiError = require('../utils/ApiError');

// Absolute path where uploaded video files are saved.
const uploadDir = path.resolve(config.upload.dir);

// Creates the upload folder on startup if it does not already exist.
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Tells Multer where to store files and how to generate unique filenames.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

// Rejects files that are not videos based on both MIME type and extension.
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = config.upload.allowedMimeTypes.includes(file.mimetype) ||
                 file.mimetype.startsWith('video/');
  const extOk  = config.upload.allowedExtensions.includes(ext);

  if (!mimeOk || !extOk) {
    return cb(
      new ApiError(415, 'INVALID_FILE_TYPE', 'Only video files are allowed.'),
      false,
    );
  }
  cb(null, true);
}

// Exposes the configured upload middleware with storage, validation, and size limit.
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSizeBytes },
});

module.exports = upload;
