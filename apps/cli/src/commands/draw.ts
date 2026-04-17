import type { Command } from 'commander';
import { parseCoord, parseIntArg } from '../util.js';
import { runSingleOp } from './apply.js';

const requireFrame = (f?: string): string => {
  if (!f) throw new Error('--frame is required (frame id or index)');
  return f;
};

export const register = (program: Command): void => {
  const draw = program.command('draw').description('mutate a single frame');

  draw
    .command('pixel')
    .description('set a single pixel')
    .requiredOption('--frame <ref>', 'frame id or index')
    .requiredOption('--x <n>')
    .requiredOption('--y <n>')
    .requiredOption('--color <hex>', '#RRGGBB or #RRGGBBAA')
    .option('--project <id>')
    .action(
      async (opts: {
        frame?: string;
        x: string;
        y: string;
        color: string;
        project?: string;
      }) => {
        const p = await runSingleOp(
          requireFrame(opts.frame),
          {
            type: 'pixel',
            x: parseIntArg(opts.x, '--x'),
            y: parseIntArg(opts.y, '--y'),
            color: opts.color,
          },
          opts.project,
        );
        process.stdout.write(`ok (v${p.version})\n`);
      },
    );

  draw
    .command('line')
    .description('draw a straight line')
    .requiredOption('--frame <ref>')
    .requiredOption('--from <x,y>')
    .requiredOption('--to <x,y>')
    .requiredOption('--color <hex>')
    .option('--thickness <n>', 'pixel width (1..4)', '1')
    .option('--project <id>')
    .action(
      async (opts: {
        frame?: string;
        from: string;
        to: string;
        color: string;
        thickness: string;
        project?: string;
      }) => {
        const p = await runSingleOp(
          requireFrame(opts.frame),
          {
            type: 'line',
            from: parseCoord(opts.from),
            to: parseCoord(opts.to),
            color: opts.color,
            thickness: parseIntArg(opts.thickness, '--thickness'),
          },
          opts.project,
        );
        process.stdout.write(`ok (v${p.version})\n`);
      },
    );

  draw
    .command('rect')
    .description('draw a rectangle (outline by default, --fill for filled)')
    .requiredOption('--frame <ref>')
    .requiredOption('--at <x,y>')
    .requiredOption('--size <w,h>')
    .requiredOption('--color <hex>')
    .option('--fill')
    .option('--project <id>')
    .action(
      async (opts: {
        frame?: string;
        at: string;
        size: string;
        color: string;
        fill?: boolean;
        project?: string;
      }) => {
        const p = await runSingleOp(
          requireFrame(opts.frame),
          {
            type: 'rect',
            at: parseCoord(opts.at),
            size: parseCoord(opts.size),
            color: opts.color,
            fill: !!opts.fill,
          },
          opts.project,
        );
        process.stdout.write(`ok (v${p.version})\n`);
      },
    );

  draw
    .command('fill')
    .description('flood fill (4-connected) starting at --x,--y')
    .requiredOption('--frame <ref>')
    .requiredOption('--x <n>')
    .requiredOption('--y <n>')
    .requiredOption('--color <hex>')
    .option('--project <id>')
    .action(
      async (opts: {
        frame?: string;
        x: string;
        y: string;
        color: string;
        project?: string;
      }) => {
        const p = await runSingleOp(
          requireFrame(opts.frame),
          {
            type: 'bucket',
            x: parseIntArg(opts.x, '--x'),
            y: parseIntArg(opts.y, '--y'),
            color: opts.color,
          },
          opts.project,
        );
        process.stdout.write(`ok (v${p.version})\n`);
      },
    );

  draw
    .command('clear')
    .description('clear the entire frame (default: fully transparent)')
    .requiredOption('--frame <ref>')
    .option('--color <hex>', 'fill color (default #00000000)')
    .option('--project <id>')
    .action(
      async (opts: { frame?: string; color?: string; project?: string }) => {
        const p = await runSingleOp(
          requireFrame(opts.frame),
          { type: 'clear', color: opts.color },
          opts.project,
        );
        process.stdout.write(`ok (v${p.version})\n`);
      },
    );
};
