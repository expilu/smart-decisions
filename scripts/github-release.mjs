import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Release-announcement step of the Release workflow. Runs after a successful
 * npm publish and:
 *
 * 1. tags the release commit as vX.Y.Z (repo convention matches the existing
 *    v0.0.2 tag) and pushes the tag;
 * 2. extracts this version's section from CHANGELOG.md and creates the GitHub
 *    release with it as the body — release notes and changelog share one
 *    source of truth.
 */
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

execSync(`git tag ${tag}`, { stdio: 'inherit' });
execSync(`git push origin ${tag}`, { stdio: 'inherit' });

const changelog = readFileSync('CHANGELOG.md', 'utf8');
const section = changelog
  .split(/^## /m)
  .find((s) => s.startsWith(`${version} `) || s.startsWith(`v${version} `));

if (!section) {
  throw new Error(`No CHANGELOG.md section found for ${version}`);
}

const notesFile = join(mkdtempSync(join(tmpdir(), 'release-notes-')), 'notes.md');
writeFileSync(notesFile, `${section.trimEnd()}\n`);

execSync(`gh release create ${tag} --title "${tag}" --notes-file "${notesFile}"`, {
  stdio: 'inherit',
});
console.log(`Created GitHub release ${tag}`);
