import fs from 'node:fs';
import path from 'node:path';

// GitLab CI template materializes build variables into files in the build
// context. Vite only knows about .env*, so these files are loaded explicitly.
// Order is ascending priority: per-job BUILDS_ENV_STRING overrides BUILDS_ENV.
const BUILD_ENV_FILES = ['builds_file.env', 'builds_string.env'];
const ENV_LINE_PATTERN = /^(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(.*)$/;

export interface IBuildEnv {
  values: Record<string, string>;
  summary: string;
}

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = ENV_LINE_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    const isQuoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));

    if (isQuoted) {
      value = value.slice(1, -1);
    } else {
      value = value.split(/[ \t]+#/)[0].trim();
    }

    parsed[key] = value;
  }

  return parsed;
}

export function loadBuildEnv(rootDir: string): IBuildEnv {
  const values: Record<string, string> = {};
  const sources: string[] = [];

  for (const name of BUILD_ENV_FILES) {
    let content: string;

    try {
      content = fs.readFileSync(path.join(rootDir, name), 'utf8');
    } catch {
      continue;
    }

    const parsed = parseEnvFile(content);

    Object.assign(values, parsed);
    sources.push(`${name} (${Object.keys(parsed).join(', ') || '-'})`);
  }

  return {
    values,
    summary: sources.join('; ') || 'none, falling back to .env*',
  };
}

export function requireEnv(
  env: Record<string, string>,
  key: string,
  context: string,
  hint: string
): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required env var ${key} for ${context}. Build env sources: ${hint}`);
  }

  return value;
}

export function readBooleanEnv(
  env: Record<string, string>,
  key: string,
  defaultValue = false
): boolean {
  const value = env[key]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`Invalid boolean env var ${key}: expected "true" or "false"`);
}

export function readAbsoluteHttpUrl(value: string, key: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${key}: expected an absolute URL`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid ${key}: expected an http or https URL`);
  }

  return url;
}

export function requireAppEnv(value: string, key: string): 'dev' | 'test' | 'production' {
  if (value === 'dev' || value === 'test' || value === 'production') {
    return value;
  }

  throw new Error(`Invalid ${key}: expected "dev", "test", or "production"`);
}
