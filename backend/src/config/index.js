'use strict';

// Reads environment variables once and exposes the settings used by the backend.
require('dotenv').config();

// Converts TRUST_PROXY from an environment string into the value Express expects.
function parseTrustProxy() {
  const value = process.env.TRUST_PROXY;

  // Render deployments usually need one trusted proxy; local development does not.
  if (!value) {
    return process.env.RENDER ? 1 : false;
  }

  // Accept common boolean-style values from .env files.
  const normalized = value.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true') return 1;

  // Numeric values mean "trust this many proxy hops".
  const numericValue = Number(normalized);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return value;
}

// Central configuration object used by the rest of the backend.
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
