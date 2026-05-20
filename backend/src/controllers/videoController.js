'use strict';

// Handles video upload requests, job status checks, and completed analysis results.
const { v4: uuidv4 } = require('uuid');
const { StatusCodes } = require('http-status-codes');
const jobStore = require('../services/jobStore');
const analysisWorker = require('../services/analysisWorker');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Accepts a video upload, creates a job record, and starts analysis in the background.
async function analyzeVideo(req, res, next) {
  try {
    // The upload middleware adds req.file; without it there is nothing to analyze.
    if (!req.file) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'MISSING_VIDEO',
        'No video file was uploaded.',
      );
    }

    // Short UUID-based job IDs are easier to pass around while still being unique enough.
    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Store the initial queued job before starting the slower analysis work.
    jobStore.create(jobId, {
      originalName: req.file.originalname,
      storedPath: req.file.path,
    });

    // Run analysis asynchronously so the API can respond immediately with a jobId.
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

// Returns the current progress for a job while analysis is still running.
async function getJobStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = jobStore.getById(jobId);

    // Unknown job IDs return a normal API error instead of crashing the server.
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

// Returns the final model result after the analysis job has completed.
async function getJobResult(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = jobStore.getById(jobId);

    // The result endpoint also validates that the requested job exists.
    if (!job) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'JOB_NOT_FOUND',
        'No analysis job exists for the given jobId.',
      );
    }

    // Failed jobs return the stored error message from the worker.
    if (job.status === 'failed') {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'ANALYSIS_FAILED',
        job.errorMessage || 'Model inference failed.',
      );
    }

    // A job must finish before the client can read its prediction output.
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
