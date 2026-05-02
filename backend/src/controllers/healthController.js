'use strict';

const { StatusCodes } = require('http-status-codes');

function healthCheck(_req, res) {
  res.status(StatusCodes.OK).json({
    status: 'ok',
    service: 'suspectiq-api',
  });
}

module.exports = { healthCheck };
