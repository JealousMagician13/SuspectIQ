'use strict';

// Custom error type used when an API route needs to return a specific status and code.
class ApiError extends Error {
  // Stores both HTTP information and a machine-readable error code.
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }

  // Formats the error response consistently for every API endpoint.
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
