import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import type { Command } from 'commander';
import { createClient, me } from '../api.js';
import { clearSession, readSession } from '../config.js';
import { AuthError } from '../client.js';
import { die } from '../util.js';

const prompt = (question: string, hide = false): Promise<string> =>
  new Promise((resolve) => {
    const rl = createInterface({ input, output });
    if (hide) {
      // Mask input by intercepting the output stream writes.
      const muted = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      const origWrite = muted._writeToOutput.bind(muted);
      muted._writeToOutput = (s: string) => {
        // Echo the prompt itself; mask typed chars.
        if (s.startsWith(question) || s === '\r\n' || s === '\n') origWrite(s);
        else origWrite('');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hide) output.write('\n');
      resolve(answer);
    });
  });

export const register = (program: Command): void => {
  program
    .command('login')
    .description('log in and persist session cookie to ~/.config/spriteman/session.json')
    .option('--email <email>', 'email address')
    .option('--api-url <url>', 'API base URL (default: SPRITEMAN_API_URL or http://localhost:3000)')
    .action(async (opts: { email?: string; apiUrl?: string }) => {
      const email = opts.email ?? (await prompt('email: ')).trim();
      const password = await prompt('password: ', true);
      const client = createClient({ apiUrl: opts.apiUrl });
      try {
        await client.login(email, password);
      } catch (err) {
        if (err instanceof AuthError) die('invalid email or password');
        throw err;
      }
      output.write(`logged in as ${email}\n`);
    });

  program
    .command('logout')
    .description('clear the stored session and invalidate it server-side')
    .action(async () => {
      const client = createClient();
      try {
        await client.post('/auth/logout');
      } catch {
        // ignore — we'll clear local state regardless
      }
      clearSession();
      output.write('logged out\n');
    });

  program
    .command('whoami')
    .description('print the currently logged-in user')
    .option('--json', 'emit JSON')
    .action(async (opts: { json?: boolean }) => {
      const s = readSession();
      if (!s) die('not logged in — run `spriteman login`');
      const client = createClient();
      const user = await me(client);
      if (opts.json) output.write(JSON.stringify(user, null, 2) + '\n');
      else output.write(`${user.email} (${user.id}) @ ${s.apiUrl}\n`);
    });
};
