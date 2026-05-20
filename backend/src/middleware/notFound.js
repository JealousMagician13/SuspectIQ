'use strict';

// Sends a JSON 404 response when no route matches the request.
const { StatusCodes } = require('http-status-codes');

// Runs after all routes and formats missing routes as API errors.
function notFound(req, res) {
  res.status(StatusCodes.NOT_FOUND).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
  });
}

module.exports = notFound;
