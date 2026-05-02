'use strict';

const { Router } = require('express');
const upload = require('../middleware/upload');
const {
  analyzeVideo,
  getJobStatus,
  getJobResult,
} = require('../controllers/videoController');

const router = Router();

/**
 * POST /api/videos/analyze
 * Accepts a single video file in the `video` field.
 */
router.post(
  '/analyze',
  upload.single('video'),
  analyzeVideo,
);

/**
 * GET /api/videos/jobs/:jobId
 * Returns job status + progress.
 */
router.get('/jobs/:jobId', getJobStatus);

/**
 * GET /api/videos/jobs/:jobId/result
 * Returns the final prediction result.
 */
router.get('/jobs/:jobId/result', getJobResult);

module.exports = router;
