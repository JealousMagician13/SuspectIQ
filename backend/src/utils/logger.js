'use strict';

// Writes structured log messages with different verbosity in development and production.
const config = require('../config');

// Lower number means a more important log level.
const levels = { error: 0, warn: 1, info: 2, debug: 3 };

// Production keeps logs quieter; development keeps debug details visible.
const currentLevel = config.env === 'production' ? 'info' : 'debug';

// Writes one structured log entry when the requested level is enabled.
function log(level, message, meta) {
  if (levels[level] > levels[currentLevel]) return;

  // Metadata is optional, so it is included only when callers provide it.
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && { meta }),
  };

  // Errors go to stderr; normal logs go to stdout for hosting log collectors.
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// Small wrapper so the rest of the app can call logger.info(), logger.error(), etc.
const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

module.exports = logger;
