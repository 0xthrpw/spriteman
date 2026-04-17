#!/usr/bin/env node
import { Command } from 'commander';
import { register as auth } from './commands/auth.js';
import { register as project } from './commands/project.js';
import { register as frame } from './commands/frame.js';
import { register as palette } from './commands/palette.js';
import { register as draw } from './commands/draw.js';
import { register as apply } from './commands/apply.js';
import { register as render } from './commands/render.js';
import { register as guide } from './commands/guide.js';
import { register as config } from './commands/config.js';
import { AuthError, ConflictError } from './client.js';

const program = new Command();
program
  .name('spriteman')
  .description('CLI for authoring pixel sprites against a spriteman backend')
  .version('0.1.0');

auth(program);
project(program);
frame(program);
palette(program);
draw(program);
apply(program);
render(program);
guide(program);
config(program);

const run = async (): Promise<void> => {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof AuthError) {
      process.stderr.write(`spriteman: ${err.message}\n`);
      process.exit(2);
    }
    if (err instanceof ConflictError) {
      process.stderr.write(
        `spriteman: version conflict — someone else updated this project (server version ${err.serverVersion ?? '?'}). retry.\n`,
      );
      process.exit(3);
    }
    if (err instanceof Error) {
      process.stderr.write(`spriteman: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
};

void run();
