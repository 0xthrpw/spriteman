import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Format: scrypt:<keylen>:<saltBase64>:<hashBase64>
const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(plain, salt, KEYLEN);
  return `scrypt:${KEYLEN}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const keylen = Number(parts[1]);
  const salt = Buffer.from(parts[2]!, 'base64');
  const expected = Buffer.from(parts[3]!, 'base64');
  if (!Number.isFinite(keylen) || expected.length !== keylen) return false;
  const actual = await scryptAsync(plain, salt, keylen);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
