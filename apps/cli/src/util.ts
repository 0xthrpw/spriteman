import { hexToRgba, type RGBA } from '@spriteman/pixel';

export const parseCoord = (s: string): [number, number] => {
  const m = s.split(',').map((x) => Number(x.trim()));
  if (m.length !== 2 || m.some((n) => !Number.isFinite(n))) {
    throw new Error(`invalid coordinate: ${s} (expected "X,Y")`);
  }
  return [m[0]!, m[1]!];
};

export const parseColor = (s: string): RGBA => hexToRgba(s);

export const parseIntArg = (s: string, name: string): number => {
  const n = Number(s);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer, got ${s}`);
  return n;
};

export const output = (json: boolean, human: string, data: unknown): void => {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    process.stdout.write(human + '\n');
  }
};

export function die(msg: string, code = 1): never {
  process.stderr.write(`spriteman: ${msg}\n`);
  process.exit(code);
}

/**
 * Parse a frame-range spec into a sorted-unique list of frame indices,
 * bounded to [0, total). Grammar:
 *   "3"            → [3]
 *   "0,2,5"        → [0, 2, 5]
 *   "0..3"         → [0, 1, 2, 3]          (inclusive)
 *   "0..15:4"      → [0, 4, 8, 12]         (range with stride)
 *   "0..3,8,10..11" → [0, 1, 2, 3, 8, 10, 11]
 */
export const parseFrameSpec = (spec: string, total: number): number[] => {
  const out = new Set<number>();
  for (const partRaw of spec.split(',')) {
    const part = partRaw.trim();
    if (part === '') continue;
    const m = part.match(/^(\d+)(?:\.\.(\d+)(?::(\d+))?)?$/);
    if (!m) throw new Error(`invalid frame spec segment: "${part}"`);
    const start = Number(m[1]);
    const end = m[2] != null ? Number(m[2]) : start;
    const stride = m[3] != null ? Number(m[3]) : 1;
    if (stride < 1) throw new Error(`stride must be >= 1 (got ${stride})`);
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    for (let i = lo; i <= hi; i += stride) out.add(i);
  }
  const list = [...out].sort((a, b) => a - b);
  for (const i of list) {
    if (i < 0 || i >= total) {
      throw new Error(`frame ${i} out of range (0..${total - 1})`);
    }
  }
  return list;
};
