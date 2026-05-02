'use strict';

/**
 * Structured API error.
 * @param {number} statusCode  HTTP status code
 * @param {string} code        Machine-readable error code (e.g. 'JOB_NOT_FOUND')
 * @param {string} message     Human-readable description
 */
class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

module.exports = ApiError;
