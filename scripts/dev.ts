import { spawn, type ChildProcess } from 'node:child_process';

import { createSpawnSpec, getApiStatus } from './devLauncher.ts';

const childProcesses: ChildProcess[] = [];
const EXPECTED_API_VERSION = '2026-05-25-fastify-ts';

function startProcess(name: string, scriptName: string) {
  const spec = createSpawnSpec(process.platform, scriptName);
  const child = spawn(spec.command, spec.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped with signal ${signal}`);
    } else {
      console.log(`[${name}] exited with code ${code ?? 0}`);
    }

    shutdown(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  childProcesses.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(exitCode: number) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting API server and Vite dev server...');
const apiHealthUrl = 'http://127.0.0.1:4175/api/health';
const apiStatus = await getApiStatus(fetch, apiHealthUrl, EXPECTED_API_VERSION);

if (apiStatus.reachable && apiStatus.compatible) {
  console.log('API server already running on http://127.0.0.1:4175, reusing it.');
} else if (apiStatus.reachable && !apiStatus.compatible) {
  console.error(
    `Existing API server on http://127.0.0.1:4175 is outdated (found ${apiStatus.apiVersion ?? 'unknown'}; expected ${EXPECTED_API_VERSION}). Stop the old API process, then run npm run dev again.`,
  );
  process.exit(1);
} else {
  startProcess('api', 'dev:api');
}

startProcess('web', 'dev:web');
