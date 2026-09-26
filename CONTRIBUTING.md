# Contributing to smart-decisions

A small, solo-maintained TypeScript library. External PRs are welcome — the
best ones are small, focused, and come with tests. For anything larger than a
bug fix, open an issue first so we can agree on the approach before you spend
time on it.

## Getting started

```bash
npm install        # Node >= 22 (see `engines` in package.json)
npm test           # confirm the suite is green before you start
npm run example    # optional; needs the provider key from .env
```

Useful scripts:

| Script                            | What it does                                      |
| --------------------------------- | ------------------------------------------------- |
| `npm run lint`                    | eslint                                            |
| `npm run format` / `format:check` | prettier write / verify                           |
| `npm run typecheck`               | `tsc` over the full project (src, test, examples) |
| `npm run build`                   | emit `dist/` (what npm ships)                     |
| `npm run test:coverage`           | vitest with the coverage gate                     |
| `npm run changeset`               | open the prompt to describe a user-facing change  |

There are no runtime dependencies — `.env` is only needed for the example.

## Quality gates

CI runs the exact gate list on every PR (Node 22 and 24):

```bash
npm run lint && npm run format:check && npm run typecheck && npm run build && npm run test:coverage
```

Two rules you cannot see coming from the code alone:

- **Coverage is capped at 100%** — lines, statements, branches and functions
  (`vitest.config.ts`). New code ships with tests covering it, or CI fails.
  `src/index.ts` (a re-export barrel) and `src/types/**` (declarations only)
  are the only exclusions.
- **Tests mirror `src/` one-to-one**: `src/utils/text/truncate.ts` is tested in
  `test/utils/text/truncate.test.ts`, same path, same name. Put new tests where
  the mirrored file would live.

## Code standards

- **Every exported symbol carries full TSDoc**: a prose description, `@param`
  for each parameter, `@returns`, `@throws`, and `@example` when usage is not
  obvious from the types. `src/utils/llms/generate-text.ts` is the exemplar —
  match it. Comments inside function bodies explain _why_, never _what_.
- **Zero runtime dependencies.** This is architectural, not incidental: since
  0.2.0 the library speaks the OpenAI-compatible HTTP protocol itself. Do not
  add runtime dependencies; dev dependencies are fine.
- **TypeScript is strict, aggressively**: `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax` (so `import type` for type-only imports). The
  typecheck gate enforces all of it.
- **ESM only, named exports.** The public surface is the barrel in
  `src/index.ts`; types live in `src/types/**` as pure declarations.
- Naming follows the existing code: files and directories in kebab-case, types
  in PascalCase, functions in camelCase.

## Changesets: when a PR needs one

A changeset declares that the **published package** changes, and what the
changelog should say. Add one whenever a PR touches `src/**`, the exports in
`package.json`, `engines`, or anything else users can observe:

```bash
npm run changeset   # pick bump type, write one paragraph of what & why
git add .changeset/ # commit the generated .md with the PR
```

Skip it for CI, tooling, test-only or docs-only changes — the tarball is
identical, so there is nothing to release.

Choosing the bump type:

- `patch` — bug fix, no user-visible semantics change
- `minor` — new feature or any user-visible behavior change; also breaking
  changes while the major version is `0` (semver allows it there)
- `major` — breaking change, once there is a 1.0 to break

What happens next is automatic: merging changeset-carrying PRs makes CI open a
"Version Packages" PR that bumps the version, rewrites `CHANGELOG.md` and keeps
`src/version.ts` in sync; merging that PR publishes to npm (with provenance),
pushes the `vX.Y.Z` tag and creates the GitHub release with the changelog
section as its notes. Releases are never cut by hand.

## Pull requests

- Branch from `main`, keep the PR focused on one change.
- Describe what changed, why, and how you verified it.
- Commit messages start with a type: `feat:`, `fix:`, `ci:`, `chore:`,
  `docs:` (soft convention — the changelog wording comes from your changeset,
  not the commit).
- PRs are squash-merged; the squash title becomes the history entry.
- CI-only PRs (workflows, `scripts/`) merge to a quiet green no-op on `main` —
  the Release workflow runs and correctly does nothing.

## Releases

You never need to publish manually. Tags (`vX.Y.Z`), npm publishing and GitHub
releases are produced by the release workflow; see `CHANGELOG.md` for the
history and the [Releases](https://github.com/expilu/smart-decisions/releases)
page for per-version notes.
