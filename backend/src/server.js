'use strict';

// Starts the API server and handles shutdown signals so the process exits cleanly.
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

// Starts listening on the configured port and logs the active environment.
const server = app.listen(config.port, () => {
  logger.info(`SuspectIQ API started`, {
    env: config.env,
    port: config.port,
    baseUrl: `http://localhost:${config.port}/api`,
    commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local',
  });
});

// Closes the HTTP server before the Node process exits.
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Forces shutdown if existing requests never finish.
  setTimeout(() => {
    logger.error('Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

// Handles normal stop signals from hosting platforms or the terminal.
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Logs promise errors that were not caught elsewhere.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

// Logs unexpected crashes before exiting with a failure code.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = server;
