'use strict';

const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Multer-specific errors
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

  // Known API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Unexpected errors
  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
}

module.exports = errorHandler;
