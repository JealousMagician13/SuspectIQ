'use strict';

// Builds the Express application: security middleware, CORS, body parsing,
// route registration, and the shared error handlers are wired here.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const healthRoutes = require('./routes/health');
const videoRoutes = require('./routes/videos');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Allows Express to understand proxy headers when deployed behind a host like Render.
app.set('trust proxy', config.trustProxy);

// Adds common HTTP security headers.
app.use(helmet()); 

// Manually handles CORS preflight requests before the route handlers run.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

// Lets the API accept requests from the frontend during local and hosted use.
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Parses JSON and form bodies before controllers try to read req.body.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan prints request logs during development and production, but not tests.
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// Registers the public health routes and the video-analysis API routes.
app.use('/', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/videos', videoRoutes);

// Any unmatched request reaches the 404 handler.
app.use(notFound);

// The error handler must be registered last so it can catch errors from above.
app.use(errorHandler);

module.exports = app;
