'use strict';

const { v4: uuidv4 } = require('uuid');
const { StatusCodes } = require('http-status-codes');
const jobStore = require('../services/jobStore');
const analysisWorker = require('../services/analysisWorker');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * POST /api/videos/analyze
 * Accepts a video file, creates an async analysis job, and returns jobId.
 */
async function analyzeVideo(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'MISSING_VIDEO',
        'No video file was uploaded.',
      );
    }

    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    jobStore.create(jobId, {
      originalName: req.file.originalname,
      storedPath: req.file.path,
    });

    // Kick off analysis asynchronously — does not block response
    analysisWorker.enqueue(jobId, req.file.path, req.file.originalname);

    logger.info('Video upload accepted', {
      jobId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    return res.status(StatusCodes.ACCEPTED).json({
      jobId,
      status: 'queued',
      message: 'Video uploaded successfully. Analysis has started.',
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/videos/jobs/:jobId
 * Returns current status and progress of an analysis job.
 */
async function getJobStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = jobStore.getById(jobId);

    if (!job) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'JOB_NOT_FOUND',
        'No analysis job exists for the given jobId.',
      );
    }

    return res.status(StatusCodes.OK).json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/videos/jobs/:jobId/result
 * Returns the final prediction once the job is completed.
 */
async function getJobResult(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = jobStore.getById(jobId);

    if (!job) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'JOB_NOT_FOUND',
        'No analysis job exists for the given jobId.',
      );
    }

    if (job.status === 'failed') {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'ANALYSIS_FAILED',
        job.errorMessage || 'Model inference failed.',
      );
    }

    if (job.status !== 'completed') {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'RESULT_NOT_READY',
        'Analysis is still processing.',
      );
    }

    return res.status(StatusCodes.OK).json({
      jobId: job.jobId,
      ...job.result,
      completedAt: job.completedAt,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { analyzeVideo, getJobStatus, getJobResult };
