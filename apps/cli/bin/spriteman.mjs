#!/usr/bin/env node
// Runtime entry for the spriteman CLI. The monorepo consumes workspace packages
// as raw TypeScript, so we delegate to tsx to load .ts directly.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '..', 'src', 'index.ts');

const tsx = resolve(here, '..', '..', '..', 'node_modules', '.bin', 'tsx');

const child = spawn(tsx, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
