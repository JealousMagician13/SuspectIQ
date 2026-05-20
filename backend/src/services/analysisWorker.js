'use strict';

// Runs the Python video-analysis script in the background and updates the job
// store as progress or final results come back from the script.
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const path = require('path');
const jobStore = require('./jobStore');
const logger = require('../utils/logger');

// Location of the Python bridge that actually runs the model.
const BRIDGE_SCRIPT = path.resolve(__dirname, '../../scripts/suspectiq_bridge.py');

// Allows deployment to override the Python command if the server needs a custom path.
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

// Maximum time allowed for one inference run before it is treated as failed.
const INFERENCE_TIMEOUT_MS = parseInt(process.env.INFERENCE_TIMEOUT_MS || '300000', 10);

// Finds the final JSON result printed by the Python bridge.
function parseBridgeOutput(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith('{') || !line.endsWith('}')) continue;

    try {
      return JSON.parse(line);
    } catch {
      // Some earlier JSON-looking lines may not be the final result.
      continue;
    }
  }

  throw new Error('No JSON payload found in inference output.');
}

// Parses one streamed line from Python, usually a progress event.
function parseBridgeEvent(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// Keeps progress inside the range shown to users before completion reaches 100%.
function clampProgress(progress) {
  const numericProgress = Number(progress);
  if (!Number.isFinite(numericProgress)) return null;

  return Math.max(0, Math.min(99, Math.round(numericProgress)));
}

// Starts the Python bridge and resolves with its parsed prediction result.
async function runInference(filePath, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    logger.debug('Spawning Python bridge', { script: BRIDGE_SCRIPT, target: filePath });

    // The Node process passes the uploaded file path to Python and listens to its output.
    const proc = spawn(PYTHON_BIN, [BRIDGE_SCRIPT, filePath], {
      env: {
        ...process.env,
        TF_CPP_MIN_LOG_LEVEL: process.env.TF_CPP_MIN_LOG_LEVEL || '2',
        TF_ENABLE_ONEDNN_OPTS: process.env.TF_ENABLE_ONEDNN_OPTS || '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stdoutLineBuffer = '';
    let stderr = '';

    // Progress events arrive through stdout while the Python script is still running.
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutLineBuffer += text;

      const lines = stdoutLineBuffer.split(/\r?\n/);
      stdoutLineBuffer = lines.pop() || '';

      for (const line of lines) {
        const event = parseBridgeEvent(line);
        if (event?.type !== 'progress') continue;

        const progress = clampProgress(event.progress);
        if (progress === null) continue;

        onProgress({
          progress,
          stage: typeof event.stage === 'string' ? event.stage : undefined,
        });
      }
    });

    // stderr is kept for logging if the bridge fails or prints diagnostics.
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    // Stops inference if Python hangs longer than the configured timeout.
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`SuspectIQ inference timed out after ${INFERENCE_TIMEOUT_MS}ms`));
    }, INFERENCE_TIMEOUT_MS);

    // When Python exits, validate its output and convert it into a JavaScript object.
    proc.on('close', (code) => {
      clearTimeout(timer);

      let parsed;
      try {
        parsed = parseBridgeOutput(stdout);
      } catch (err) {
        logger.error('Python bridge returned non-JSON output', { stdout, stderr });
        return reject(new Error(`Inference process returned invalid output: ${err.message}`));
      }

      if (parsed.error) {
        logger.error('Python bridge reported an error', { error: parsed.error, stderr });
        return reject(new Error(parsed.error));
      }

      if (code !== 0) {
        logger.error('Python bridge exited with non-zero code', { code, stderr });
        return reject(new Error(`Inference process exited with code ${code}.`));
      }

      logger.debug('Python bridge succeeded', { result: parsed });
      resolve(parsed);
    });

    // Handles failures that happen before Python starts correctly.
    proc.on('error', (err) => {
      clearTimeout(timer);
      logger.error('Failed to spawn Python bridge', { error: err.message });
      reject(new Error(`Could not start inference process: ${err.message}`));
    });
  });
}

// Starts a background analysis job and writes each state change to the job store.
async function enqueue(jobId, filePath, originalName) {
  logger.info('Analysis job enqueued', { jobId, originalName });

  // setImmediate lets the upload response finish before heavier processing starts.
  setImmediate(async () => {
    try {
      // Mark the job as active so the frontend can show progress right away.
      jobStore.update(jobId, {
        status: 'processing',
        progress: 5,
        stage: 'Starting analysis',
      });

      // Run inference and update the stored progress whenever Python emits progress.
      const inference = await runInference(filePath, ({ progress, stage }) => {
        const currentJob = jobStore.getById(jobId);
        const currentProgress = currentJob?.progress || 0;

        jobStore.update(jobId, {
          status: 'processing',
          progress: Math.max(currentProgress, progress),
          ...(stage ? { stage } : {}),
        });
      });

      // Store the final prediction in the same shape the result endpoint returns.
      jobStore.update(jobId, {
        status: 'completed',
        progress: 100,
        stage: 'Analysis complete',
        completedAt: new Date().toISOString(),
        result: {
          videoId: `vid_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
          filename: originalName,
          ...inference,
        },
      });

      logger.info('Analysis job completed', { jobId, prediction: inference.prediction });
    } catch (err) {
      // Failed jobs keep their error message so the result endpoint can report it.
      logger.error('Analysis job failed', { jobId, error: err.message });
      const currentJob = jobStore.getById(jobId);

      jobStore.update(jobId, {
        status: 'failed',
        progress: currentJob?.progress || 0,
        stage: 'Analysis failed',
        errorMessage: err.message,
        completedAt: new Date().toISOString(),
      });
    }
  });
}

module.exports = { enqueue };
