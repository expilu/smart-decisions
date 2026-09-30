import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Names the Version Packages PR after the release it prepares. Runs on the
 * Release workflow BEFORE changesets/action, because the action reads its
 * title/commit inputs once at startup — a script running inside it could never
 * influence its own PR.
 *
 * Output: `VERSION_PR_TITLE` / `VERSION_PR_COMMIT` ("Version: 0.4.0") written
 * to $GITHUB_ENV; release.yml passes them as the action's title/commit inputs,
 * falling back to the action defaults ("Version Packages") when unset.
 *
 * The version comes from the pending changesets — read by `changeset status
 * --output=json`, i.e. assembled by changesets itself (same release-plan
 * pipeline as `changeset version`), so bump precedence and pre-release
 * suffixes are exactly what the version command will produce. No parsing of
 * changeset files happens here.
 *
 * Every non-computable situation is a quiet no-op — never a failure — because
 * this script runs on EVERY push to main, and the runs that reach it without
 * a pending release (post-merge publish path, CI-only pushes, retries) are
 * normal: with the env vars unset, the action falls back to its defaults,
 * which those runs never use anyway (no pending changesets means no version
 * PR is opened). Hard failures here would only add noise on top of whatever
 * the action reports more precisely — e.g. its own strict parser on a corrupt
 * changeset.
 *
 * Expects .changeset/ to exist; `getPackages` (via `changeset status`) throws
 * otherwise, which lands in the no-op path above.
 */

const PACKAGE_NAME = 'smart-decisions'; // single package; root package.json
const VERSION_RE = /^\d+\.\d+\.\d+(-[A-Za-z0-9.\-+]+)?$/;

const require = createRequire(import.meta.url);
const cliBin = require.resolve('@changesets/cli/bin.js');

function computeVersion() {
  const dir = mkdtempSync(join(tmpdir(), 'version-pr-meta-'));
  try {
    const planPath = join(dir, 'plan.json');
    execFileSync(process.execPath, [cliBin, 'status', '--output', planPath], {
      stdio: 'ignore',
    });
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    return plan.releases.find((r) => r.name === PACKAGE_NAME)?.newVersion;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let version;
try {
  version = computeVersion();
} catch (error) {
  console.log(
    `version-pr-meta: could not compute a version (no pending changesets?); leaving the action defaults in place. (${error?.message ?? error})`,
  );
  process.exit(0);
}

if (!version || !VERSION_RE.test(version)) {
  if (version) {
    console.log(`version-pr-meta: computed version ${version} failed sanity check; no-op.`);
  } else {
    console.log('version-pr-meta: no pending release; no-op.');
  }
  process.exit(0);
}

const message = `Version: ${version}`;

if (!process.env.GITHUB_ENV) {
  console.log(`version-pr-meta: not in GitHub Actions; would set "${message}".`);
  process.exit(0);
}

// Single-line NAME=value is the unambiguous GITHUB_ENV format; our value is a
// validated one-line version string.
writeFileSync(
  process.env.GITHUB_ENV,
  `VERSION_PR_TITLE=${message}\nVERSION_PR_COMMIT=${message}\n`,
  {
    flag: 'a',
  },
);
console.log(`version-pr-meta: ${message}`);
