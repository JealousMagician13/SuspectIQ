'use strict';

/**
 * Simple in-memory job store.
 *
 * In production, replace with a persistent store (Redis, PostgreSQL, etc.).
 * The interface is kept intentionally thin so swapping is straightforward.
 */

const jobs = new Map();

/**
 * @typedef {Object} Job
 * @property {string}  jobId
 * @property {string}  status          - queued | processing | completed | failed
 * @property {number}  progress        - 0–100
 * @property {string}  stage
 * @property {string}  originalName
 * @property {string}  storedPath
 * @property {Object|null} result
 * @property {string|null} errorMessage
 * @property {string}  createdAt
 * @property {string|null} completedAt
 */

/**
 * Create a new job entry.
 * @param {string} jobId
 * @param {Object} data
 * @returns {Job}
 */
function create(jobId, data) {
  const job = {
    jobId,
    status: 'queued',
    progress: 0,
    stage: 'Queued',
    originalName: data.originalName,
    storedPath: data.storedPath,
    result: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  jobs.set(jobId, job);
  return job;
}

/**
 * Retrieve a job by ID.
 * @param {string} jobId
 * @returns {Job|undefined}
 */
function getById(jobId) {
  return jobs.get(jobId);
}

/**
 * Update fields on an existing job.
 * @param {string} jobId
 * @param {Partial<Job>} updates
 * @returns {Job|null}
 */
function update(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

module.exports = { create, getById, update };
