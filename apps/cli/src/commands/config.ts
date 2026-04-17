import type { Command } from 'commander';
import { readConfig, writeConfig } from '../config.js';
import { die } from '../util.js';

const KEYS = ['api-url'] as const;
type Key = (typeof KEYS)[number];

const isKey = (s: string): s is Key => (KEYS as readonly string[]).includes(s);

export const register = (program: Command): void => {
  const config = program.command('config').description('read/write persistent CLI config (~/.config/spriteman/config.json)');

  config
    .command('get <key>')
    .description(`get a config value. keys: ${KEYS.join(', ')}`)
    .action((key: string) => {
      if (!isKey(key)) die(`unknown key: ${key} (valid: ${KEYS.join(', ')})`);
      const c = readConfig();
      if (key === 'api-url') {
        process.stdout.write(`${c.apiUrl ?? ''}\n`);
      }
    });

  config
    .command('set <key> <value>')
    .description(`set a config value. keys: ${KEYS.join(', ')}`)
    .action((key: string, value: string) => {
      if (!isKey(key)) die(`unknown key: ${key} (valid: ${KEYS.join(', ')})`);
      const c = readConfig();
      if (key === 'api-url') c.apiUrl = value;
      writeConfig(c);
      process.stdout.write(`set ${key} = ${value}\n`);
    });

  config
    .command('unset <key>')
    .description('remove a config value')
    .action((key: string) => {
      if (!isKey(key)) die(`unknown key: ${key} (valid: ${KEYS.join(', ')})`);
      const c = readConfig();
      if (key === 'api-url') delete c.apiUrl;
      writeConfig(c);
      process.stdout.write(`unset ${key}\n`);
    });
};
