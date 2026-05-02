'use strict';

const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const path = require('path');
const jobStore = require('./jobStore');
const logger = require('../utils/logger');

const BRIDGE_SCRIPT = path.resolve(__dirname, '../../scripts/suspectiq_bridge.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
// Timeout for the Python process (default: 5 minutes)
const INFERENCE_TIMEOUT_MS = parseInt(process.env.INFERENCE_TIMEOUT_MS || '300000', 10);

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
      // Keep scanning earlier lines.
    }
  }

  throw new Error('No JSON payload found in inference output.');
}

/**
 * Runs SuspectIQ prediction by spawning the Python bridge script.
 *
 * @param {string} filePath - Absolute path to the uploaded video file
 * @returns {Promise<Object>} - Parsed prediction result
 */
async function runInference(filePath) {
  return new Promise((resolve, reject) => {
    logger.debug('Spawning Python bridge', { script: BRIDGE_SCRIPT, target: filePath });

    const proc = spawn(PYTHON_BIN, [BRIDGE_SCRIPT, filePath], {
      env: {
        ...process.env,
        TF_CPP_MIN_LOG_LEVEL: process.env.TF_CPP_MIN_LOG_LEVEL || '2',
        TF_ENABLE_ONEDNN_OPTS: process.env.TF_ENABLE_ONEDNN_OPTS || '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`SuspectIQ inference timed out after ${INFERENCE_TIMEOUT_MS}ms`));
    }, INFERENCE_TIMEOUT_MS);

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

    proc.on('error', (err) => {
      clearTimeout(timer);
      logger.error('Failed to spawn Python bridge', { error: err.message });
      reject(new Error(`Could not start inference process: ${err.message}`));
    });
  });
}

/**
 * Enqueue a video for analysis.
 * Updates job store throughout the lifecycle.
 *
 * @param {string} jobId
 * @param {string} filePath
 * @param {string} originalName
 */
async function enqueue(jobId, filePath, originalName) {
  logger.info('Analysis job enqueued', { jobId, originalName });

  // Mark as processing immediately (non-blocking for caller)
  setImmediate(async () => {
    try {
      jobStore.update(jobId, { status: 'processing', progress: 10 });


      const inference = await runInference(filePath);

      jobStore.update(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
        result: {
          videoId: `vid_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
          filename: originalName,
          ...inference,
        },
      });

      logger.info('Analysis job completed', { jobId, prediction: inference.prediction });
    } catch (err) {
      logger.error('Analysis job failed', { jobId, error: err.message });
      jobStore.update(jobId, {
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date().toISOString(),
      });
    }
  });
}

module.exports = { enqueue };
