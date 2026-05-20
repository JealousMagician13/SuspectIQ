'use strict';

// Keeps track of analysis jobs while the server is running. Each job stores
// the upload path, current progress, final result, or error details.
const jobs = new Map();

// Creates the first job entry when a video upload is accepted.
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

// Finds a job by ID so controllers and workers can read its latest state.
function getById(jobId) {
  return jobs.get(jobId);
}

// Merges new fields into an existing job as progress or results change.
function update(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;

  // Progress should only move forward for the same job, never jump backward.
  if (typeof updates.progress === 'number' && typeof job.progress === 'number') {
    updates.progress = Math.max(job.progress, updates.progress);
  }

  Object.assign(job, updates);
  return job;
}

module.exports = { create, getById, update };
