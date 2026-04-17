import pako from 'pako';

export type RGBA = readonly [number, number, number, number];
export const TRANSPARENT: RGBA = [0, 0, 0, 0];

export function rgbaEqual(a: RGBA, b: RGBA): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

// Hex parsing: accepts #RGB, #RRGGBB, #RRGGBBAA
export function hexToRgba(hex: string): RGBA {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  if (s.length === 3) {
    const r = parseInt(s[0]! + s[0]!, 16);
    const g = parseInt(s[1]! + s[1]!, 16);
    const b = parseInt(s[2]! + s[2]!, 16);
    return [r, g, b, 255];
  }
  if (s.length === 6) {
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
      255,
    ];
  }
  if (s.length === 8) {
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
      parseInt(s.slice(6, 8), 16),
    ];
  }
  throw new Error(`invalid hex color: ${hex}`);
}

export function rgbaToHex(rgba: RGBA): string {
  const [r, g, b, a] = rgba;
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${h(a)}`;
}

// A mutable 2D pixel buffer wrapping Uint8ClampedArray in RGBA layout.
export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number, data?: Uint8ClampedArray) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8ClampedArray(width * height * 4);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  get(x: number, y: number): RGBA {
    const i = this.index(x, y);
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  set(x: number, y: number, color: RGBA): void {
    const i = this.index(x, y);
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = color[3];
  }

  clone(): PixelBuffer {
    return new PixelBuffer(this.width, this.height, new Uint8ClampedArray(this.data));
  }

  // DOM bridge — only safe to call in a browser/worker environment.
  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
  }

  // Encode as base64(deflate(rgba))
  encode(): string {
    const view = new Uint8Array(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    const deflated = pako.deflate(view);
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < deflated.length; i += CHUNK) {
      s += String.fromCharCode(...deflated.subarray(i, i + CHUNK));
    }
    if (typeof btoa === 'function') return btoa(s);
    return Buffer.from(s, 'binary').toString('base64');
  }

  static decode(width: number, height: number, encoded: string): PixelBuffer {
    let bytes: Uint8Array;
    if (typeof atob === 'function') {
      const binary = atob(encoded);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      const buf = Buffer.from(encoded, 'base64');
      bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const inflated = pako.inflate(bytes);
    if (inflated.length !== width * height * 4) {
      throw new Error(
        `decoded pixel buffer size ${inflated.length} does not match ${width}x${height}x4`,
      );
    }
    return new PixelBuffer(width, height, new Uint8ClampedArray(inflated.buffer));
  }
}
