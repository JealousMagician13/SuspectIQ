'use strict';

const { StatusCodes } = require('http-status-codes');

function notFound(req, res) {
  res.status(StatusCodes.NOT_FOUND).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
  });
}

module.exports = notFound;
