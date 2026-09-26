import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Publish step of the Release workflow (changesets action's `publish` input).
 *
 * - Builds dist/ fresh before publishing.
 * - Unsets GITHUB_TOKEN from the environment: with it present, npm refuses to
 *   fall through to OIDC trusted publishing.
 * - Publishes with --provenance (requires npm >= 11.5 and the Trusted Publisher
 *   registered on npmjs.com for this repo + workflow).
 * - Idempotent: skips if the exact version is already on the registry (safe on
 *   workflow retries).
 */
const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));

const env = { ...process.env };
delete env.GITHUB_TOKEN;

execSync('npm run build', { stdio: 'inherit' });

let exists = false;
try {
  execSync(`npm view ${name}@${version} version`, { env, stdio: 'ignore' });
  exists = true;
} catch {
  exists = false;
}

if (exists) {
  console.log(`${name}@${version} is already published — nothing to do.`);
} else {
  execSync(`npm publish --provenance --access public`, { env, stdio: 'inherit' });
  console.log(`Published ${name}@${version}`);
}
