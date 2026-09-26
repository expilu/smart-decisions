import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Publish + announcement step of the Release workflow (changesets action's
 * `publish` input). Only runs on the publish path — pushes to main with
 * pending changesets never reach this script.
 *
 * - Builds dist/ fresh before publishing.
 * - Unsets GITHUB_TOKEN from the npm environment: with it present, npm refuses
 *   to fall through to OIDC trusted publishing.
 * - Publishes with --provenance (npm >= 11.5 and the Trusted Publisher
 *   registered on npmjs.com for this repo + workflow).
 * - Retries are safe: publish is skipped if the exact version is already
 *   registered.
 * - Announces idempotently: tags vX.Y.Z at HEAD and creates the GitHub release
 *   from this version's CHANGELOG.md section, skipping whichever already
 *   exists. Runs on every publish-path run, so a stranded announcement heals
 *   on the next run — necessary because the registry's post-upload validation
 *   window can keep a freshly accepted version invisible to registry checks.
 */
const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

const env = { ...process.env };
delete env.GITHUB_TOKEN;

execSync('npm run build', { stdio: 'inherit' });

let registered = false;
try {
  execSync(`npm view ${name}@${version} version`, { env, stdio: 'ignore' });
  registered = true;
} catch {
  registered = false;
}

if (registered) {
  console.log(`${name}@${version} is already registered — skipping publish.`);
} else {
  execSync('npm publish --provenance --access public', { env, stdio: 'inherit' });
  console.log(`Published ${name}@${version}`);
}

const section = readFileSync('CHANGELOG.md', 'utf8')
  .split(/^## /m)
  .find((s) => s.startsWith(`${version} `) || s.startsWith(`v${version} `));

if (!section) {
  if (registered) {
    console.warn(`No CHANGELOG.md section for ${version} — skipping announcement.`);
    process.exit(0);
  }
  throw new Error(`No CHANGELOG.md section found for ${version}`);
}

const tagRemote = execSync(`git ls-remote origin refs/tags/${tag}`, { encoding: 'utf8' });
if (tagRemote.includes(`refs/tags/${tag}`)) {
  console.log(`Tag ${tag} already exists — skipping.`);
} else {
  execSync(`git tag ${tag} && git push origin ${tag}`, { stdio: 'inherit' });
  console.log(`Tagged ${tag}`);
}

let releaseExists = false;
try {
  execSync(`gh release view ${tag}`, { stdio: 'ignore' });
  releaseExists = true;
} catch {
  releaseExists = false;
}

if (releaseExists) {
  console.log(`GitHub release ${tag} already exists — skipping.`);
} else {
  const notesFile = join(mkdtempSync(join(tmpdir(), 'release-notes-')), 'notes.md');
  writeFileSync(notesFile, `${section.trimEnd()}\n`);
  execSync(`gh release create ${tag} --title ${tag} --notes-file ${notesFile}`, {
    stdio: 'inherit',
  });
  console.log(`Created GitHub release ${tag}`);
}
