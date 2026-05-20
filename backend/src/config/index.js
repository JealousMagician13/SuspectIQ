'use strict';

require('dotenv').config();

function parseTrustProxy() {
  const value = process.env.TRUST_PROXY;

  if (!value) {
    return process.env.RENDER ? 1 : false;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true') return 1;

  const numericValue = Number(normalized);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  trustProxy: parseTrustProxy(),

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    allowRenderOrigins: process.env.ALLOW_RENDER_ORIGINS !== 'false',
  },

  upload: {
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10) * 1024 * 1024,
    dir: process.env.UPLOAD_DIR || 'uploads',
    allowedMimeTypes: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/webm',
      'video/mpeg',
      'video/x-ms-wmv',
    ],
    allowedExtensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.mpg', '.wmv'],
  },

};

module.exports = config;
