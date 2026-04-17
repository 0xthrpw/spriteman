import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Session = {
  cookie: string;
  apiUrl: string;
  email: string;
  savedAt: string;
};

export type Active = {
  projectId: string;
};

export type Config = {
  apiUrl?: string;
};

const configDir = (): string => {
  const xdg = process.env['XDG_CONFIG_HOME'];
  return xdg ? join(xdg, 'spriteman') : join(homedir(), '.config', 'spriteman');
};

const sessionPath = (): string => join(configDir(), 'session.json');
const activePath = (): string => join(configDir(), 'active.json');
const configPath = (): string => join(configDir(), 'config.json');

const ensureDir = () => {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
};

export const readSession = (): Session | null => {
  const p = sessionPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Session;
  } catch {
    return null;
  }
};

export const writeSession = (s: Session): void => {
  ensureDir();
  const p = sessionPath();
  writeFileSync(p, JSON.stringify(s, null, 2), { mode: 0o600 });
  chmodSync(p, 0o600);
};

export const clearSession = (): void => {
  const p = sessionPath();
  if (existsSync(p)) rmSync(p);
};

export const readActive = (): Active | null => {
  const p = activePath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Active;
  } catch {
    return null;
  }
};

export const writeActive = (a: Active): void => {
  ensureDir();
  writeFileSync(activePath(), JSON.stringify(a, null, 2));
};

export const readConfig = (): Config => {
  const p = configPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Config;
  } catch {
    return {};
  }
};

export const writeConfig = (c: Config): void => {
  ensureDir();
  writeFileSync(configPath(), JSON.stringify(c, null, 2));
};

export const DEFAULT_API_URL = 'http://localhost:3001';

// Resolution order: explicit arg (handled by caller) → env → session → config → default.
export const resolveApiUrl = (): string => {
  const env = process.env['SPRITEMAN_API_URL'];
  if (env) return env;
  const sess = readSession();
  if (sess?.apiUrl) return sess.apiUrl;
  const cfg = readConfig();
  if (cfg.apiUrl) return cfg.apiUrl;
  return DEFAULT_API_URL;
};

// Kept for backwards-compat with existing callers that only want env-or-default
// (primarily the `login` path, which runs before a session exists).
export const defaultApiUrl = (): string => {
  const env = process.env['SPRITEMAN_API_URL'];
  if (env) return env;
  const cfg = readConfig();
  if (cfg.apiUrl) return cfg.apiUrl;
  return DEFAULT_API_URL;
};

export const resolveProjectId = (explicit?: string): string => {
  if (explicit) return explicit;
  const fromEnv = process.env['SPRITEMAN_PROJECT'];
  if (fromEnv) return fromEnv;
  const a = readActive();
  if (a?.projectId) return a.projectId;
  throw new Error(
    'no project id — pass --project, set SPRITEMAN_PROJECT, or run `spriteman project use <id>`',
  );
};
