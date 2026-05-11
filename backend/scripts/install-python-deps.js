'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const requirementsPath = path.resolve(__dirname, '../requirements.txt');
const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

for (const pythonBin of candidates) {
  const result = spawnSync(pythonBin, ['-m', 'pip', 'install', '-r', requirementsPath], {
    stdio: 'inherit',
  });

  if (result.status === 0) {
    process.exit(0);
  }

  if (result.error && result.error.code !== 'ENOENT') {
    console.error(`Failed to install Python dependencies with ${pythonBin}: ${result.error.message}`);
  }
}

console.error('Failed to install Python dependencies. Make sure Python and pip are available in the build environment.');
process.exit(1);
