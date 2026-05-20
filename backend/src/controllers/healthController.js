'use strict';

// Responds to health-check requests so the frontend or hosting service can verify the API is running.
const { StatusCodes } = require('http-status-codes');
const config = require('../config');

// Returns simple service information that proves the API is alive.
function healthCheck(_req, res) {
  const apiBaseUrl = `http://localhost:${config.port}/api`;

  res.status(StatusCodes.OK).json({
    status: 'ok',
    service: 'suspectiq-api',
    apiBaseUrl,
    healthUrl: `${apiBaseUrl}/health`,
    commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local',
  });
}

module.exports = { healthCheck };
