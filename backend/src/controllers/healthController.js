'use strict';

const { StatusCodes } = require('http-status-codes');
const config = require('../config');

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
