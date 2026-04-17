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
