import type { Command } from 'commander';
import { createClient, createPalette, listPalettes } from '../api.js';
import { output } from '../util.js';

export const register = (program: Command): void => {
  const palette = program.command('palette').description('manage palettes');

  palette
    .command('list')
    .description('list palettes (yours + built-ins)')
    .option('--json', 'emit JSON')
    .action(async (opts: { json?: boolean }) => {
      const c = createClient();
      const pals = await listPalettes(c);
      if (opts.json) output(true, '', pals);
      else
        for (const p of pals)
          process.stdout.write(
            `${p.id}  ${p.userId ? 'custom' : 'builtin'}  ${p.name} (${p.colors.length} colors)\n`,
          );
    });

  palette
    .command('create <name>')
    .description('create a palette')
    .requiredOption('--colors <csv>', 'comma-separated list of hex colors (#RRGGBB or #RRGGBBAA)')
    .option('--json', 'emit JSON')
    .action(async (name: string, opts: { colors: string; json?: boolean }) => {
      const colors = opts.colors.split(',').map((s) => s.trim()).filter(Boolean);
      const c = createClient();
      const p = await createPalette(c, { name, colors });
      if (opts.json) output(true, '', p);
      else process.stdout.write(`created palette ${p.id}  ${p.name}\n`);
    });
};
