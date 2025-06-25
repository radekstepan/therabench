#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// This wrapper script enables seamless integration with Infisical for secrets management.
// It checks for an Infisical configuration and, if found, uses `infisical run`
// to inject secrets into the environment before executing the main application.
// Otherwise, it runs the application directly, using the local .env file.

// Determine the project root directory (location of package.json)
const projectRoot = path.resolve(__dirname, '..');
const workingDirectory = process.cwd();

// Function to check for .infisical.json in the current working dir or project root.
const findInfisicalConfig = () => {
  const workingDirConfig = path.join(workingDirectory, '.infisical.json');
  if (fs.existsSync(workingDirConfig)) {
    return { exists: true, dir: workingDirectory };
  }

  const projectRootConfig = path.join(projectRoot, '.infisical.json');
  if (fs.existsSync(projectRootConfig)) {
    return { exists: true, dir: projectRoot };
  }

  return { exists: false };
};

// Path to the compiled main application script
const scriptPath = path.join(projectRoot, 'dist/index.js');

const infisicalConfig = findInfisicalConfig();

function runDirectly() {
  const nodeArgs = [scriptPath, ...process.argv.slice(2)];
  const nodeChild = spawn('node', nodeArgs, { stdio: 'inherit' });

  nodeChild.on('error', (err) => {
    console.error('Failed to spawn Node.js process:', err);
    process.exit(1);
  });

  nodeChild.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code === null ? 1 : code);
    }
  });
}

if (infisicalConfig.exists) {
  console.log(`[Thera-Bench] Found Infisical config, attempting to run with secrets...`);
  const args = [
    'run',
    `--project-config-dir=${infisicalConfig.dir}`,
    '--',
    'node',
    scriptPath,
    ...process.argv.slice(2),
  ];

  const child = spawn('infisical', args, { stdio: 'inherit' });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('[Thera-Bench] Infisical CLI not found. Please install it or remove your .infisical.json file.');
      console.error('[Thera-Bench] See: https://infisical.com/docs/cli/overview');
    } else {
      console.error('[Thera-Bench] Failed to spawn Infisical process:', err);
    }
    console.log('[Thera-Bench] Falling back to direct execution without Infisical...');
    runDirectly();
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code === null ? 1 : code);
    }
  });
} else {
  runDirectly();
}
