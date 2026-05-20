'use strict';

// Defines the video-analysis API endpoints and connects them to the controller.
const { Router } = require('express');
const upload = require('../middleware/upload');
const {
  analyzeVideo,
  getJobStatus,
  getJobResult,
} = require('../controllers/videoController');

const router = Router();

// Uploads one video file and starts a new analysis job.
router.post(
  '/analyze',
  upload.single('video'),
  analyzeVideo,
);

// Reads the current status and progress of an analysis job.
router.get('/jobs/:jobId', getJobStatus);

// Reads the completed prediction result for an analysis job.
router.get('/jobs/:jobId/result', getJobResult);

module.exports = router;
