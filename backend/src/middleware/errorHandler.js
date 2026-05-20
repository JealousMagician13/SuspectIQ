'use strict';

// Converts application, upload, and unexpected errors into consistent JSON responses.
const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
// Express calls this whenever a controller or middleware passes an error to next().
function errorHandler(err, req, res, next) {
  // Multer errors come from file upload validation, such as file size limits.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(StatusCodes.REQUEST_TOO_LONG).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Uploaded file exceeds the size limit.',
        },
      });
    }
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: {
        code: 'INVALID_REQUEST',
        message: err.message,
      },
    });
  }

  // ApiError is used for expected application errors with known status codes.
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Anything else is treated as an unexpected server error and logged.
  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
}

module.exports = errorHandler;
