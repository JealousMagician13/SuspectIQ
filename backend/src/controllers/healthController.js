'use strict';

const { StatusCodes } = require('http-status-codes');

function healthCheck(_req, res) {
  res.status(StatusCodes.OK).json({
    status: 'ok',
    service: 'suspectiq-api',
    commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local',
  });
}

module.exports = { healthCheck };
