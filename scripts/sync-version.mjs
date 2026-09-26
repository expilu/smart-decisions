import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Keeps src/version.ts in sync with package.json. Runs inside the Version
 * Packages PR (wired into changesets' `version` step), so the VERSION constant
 * — shown in the User-Agent of every request — bumps together with the package.
 *
 * test/version.test.ts stays the tripwire: if this script is ever skipped,
 * the version test fails in that same PR.
 */
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const path = 'src/version.ts';
const code = readFileSync(path, 'utf8');
const updated = code.replace(
  /export const VERSION = '[^']*';/,
  `export const VERSION = '${pkg.version}';`,
);

if (updated === code) {
  console.error('sync-version: no version literal replaced in src/version.ts.');
  process.exitCode = 1;
} else {
  writeFileSync(path, updated);
  console.log(`sync-version: src/version.ts -> ${pkg.version}`);
}
