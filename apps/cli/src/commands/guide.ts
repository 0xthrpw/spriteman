import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';

const here = dirname(fileURLToPath(import.meta.url));
// Works for both `tsx src/index.ts` (here = src/commands) and
// `node dist/index.js` (here = dist/commands): the .md file is copied into dist
// by the build script, or read directly from src in dev.
const GUIDE_CANDIDATES = [
  join(here, '..', 'guide', 'pixel-art.md'),
  join(here, '..', '..', 'src', 'guide', 'pixel-art.md'),
];

const loadGuide = (): string => {
  for (const p of GUIDE_CANDIDATES) {
    try {
      return readFileSync(p, 'utf8');
    } catch {
      continue;
    }
  }
  throw new Error(`could not locate guide; looked in: ${GUIDE_CANDIDATES.join(', ')}`);
};

const normalizeSlug = (s: string) => s.trim().toLowerCase().replace(/[-_\s]+/g, ' ');

const extractSection = (md: string, slug: string): string | null => {
  const lines = md.split('\n');
  const want = normalizeSlug(slug);
  let capture = false;
  const out: string[] = [];
  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      if (capture) break;
      if (normalizeSlug(h2[1]!) === want) {
        capture = true;
        out.push(line);
        continue;
      }
    }
    if (capture) out.push(line);
  }
  return out.length ? out.join('\n').trimEnd() : null;
};

const listTopics = (md: string): string[] => {
  const topics: string[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^## (.+)$/);
    if (m) topics.push(m[1]!.trim());
  }
  return topics;
};

export const register = (program: Command): void => {
  program
    .command('guide [topic]')
    .description('print the pixel-art guide (omit topic for a topic list + intro)')
    .action((topic: string | undefined) => {
      const md = loadGuide();
      if (!topic) {
        const intro = extractSection(md, 'overview') ?? '';
        const topics = listTopics(md).filter((t) => t !== 'overview');
        process.stdout.write(`${intro}\n\nAvailable topics:\n`);
        for (const t of topics) process.stdout.write(`  spriteman guide ${t}\n`);
        return;
      }
      const section = extractSection(md, topic);
      if (!section) {
        process.stderr.write(
          `no such topic: ${topic}\navailable: ${listTopics(md).join(', ')}\n`,
        );
        process.exit(1);
      }
      process.stdout.write(section + '\n');
    });
};
