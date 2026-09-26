import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version.js';

// The User-Agent header exposes this constant to servers, and publishing gates on
// tests: a drift between the constant and package.json fails here, before a stale
// version lands in the header.
describe('version', () => {
  it('matches the package.json version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
  });
});
