/**
 * Live smoke test for System 2, against the model the .env points at.
 *
 * Runs every primitive in System 2 mode — with thinking off and with the
 * engine default — through the library's own public API, checks the answer
 * shapes at the level a caller can observe, and exits nonzero on any shape
 * violation. Not a quality judgment: the point is that every path returns
 * well-formed answers on a real engine, whatever the verdicts are.
 *
 * Usage: npm run smoke:system2  (needs .env with API_BASE_URL / API_KEY)
 */

import { choice, score, noul } from '../src/index.js';
import type { ChoiceAnswer } from '../src/types/choice-answer.js';
import type { NoulAnswer } from '../src/types/noul-answer.js';
import type { ScoreAnswer } from '../src/types/score-answer.js';
import { VERSION } from '../src/version.js';

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

const CHOICE_CRITERIA = { walk: 'Go for a walk', movie: 'Watch a movie', beach: 'Go to the beach' };
const SCORE_LEVELS = ['Whenever is fine', 'Before the day ends', 'Right now, drop everything'];

const failures: string[] = [];

function check(where: string, ok: boolean, detail: string): void {
  console.log(`${ok ? '✓' : '✗'} ${where} — ${detail}`);
  if (!ok) failures.push(`${where}: ${detail}`);
}

function validateChoice(where: string, answer: ChoiceAnswer): void {
  const names = Object.keys(CHOICE_CRITERIA);
  const values = Object.values(answer.probabilities);
  check(where, names.includes(answer.choice), 'winner is an option');
  check(
    where,
    Object.keys(answer.probabilities).length === names.length &&
      names.every((option) => option in answer.probabilities),
    'one probability per option',
  );
  check(
    where,
    values.every((p) => Number.isFinite(p) && p >= 0),
    'probabilities are finite and non-negative',
  );
  const sum = values.reduce((a, b) => a + b, 0);
  check(where, Math.abs(sum - 1) < 1e-9, `probabilities sum to 1 (got ${sum.toFixed(9)})`);
  check(
    where,
    Number.isFinite(answer.confidence) && answer.confidence >= 0 && answer.confidence <= 1,
    `confidence 0..1 (got ${answer.confidence})`,
  );
}

function validateScore(where: string, answer: ScoreAnswer): void {
  const keys = SCORE_LEVELS.map((_, i) => `${i}`);
  check(
    where,
    keys.every((k) => k in answer.probabilities && answer.legend[k] === SCORE_LEVELS[Number(k)]),
    'one probability + legend per level',
  );
  const sum = Object.values(answer.probabilities).reduce((a, b) => a + b, 0);
  check(where, Math.abs(sum - 1) < 1e-9, `probabilities sum to 1 (got ${sum.toFixed(9)})`);
  check(
    where,
    answer.score >= 0 && answer.score <= SCORE_LEVELS.length - 1,
    `score inside the spectrum (got ${answer.score})`,
  );
}

function validateNoul(where: string, answer: NoulAnswer): void {
  check(
    where,
    Number.isFinite(answer.noul) && answer.noul >= 0 && answer.noul <= 1,
    `noul 0..1 (got ${answer.noul})`,
  );
}

console.log(`smart-decisions smoke, v${VERSION} — ${model.model} @ ${model.apiBaseUrl}`);

const questionBase = {
  model: model,
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
};

for (const thinking of [false, undefined]) {
  const label = `choice (thinking ${thinking === false ? 'off' : 'engine default'})`;
  console.time(label);
  const answer = await choice({
    ...questionBase,
    mode: 'system2',
    criteria: CHOICE_CRITERIA,
    ...(thinking === false ? { thinking } : {}),
  });
  console.timeEnd(label);
  validateChoice(label, answer);
}

for (const thinking of [false, undefined]) {
  const label = `score (thinking ${thinking === false ? 'off' : 'engine default'})`;
  console.time(label);
  const answer = await score({
    model: model,
    mode: 'system2',
    state:
      'Can you hop on a quick call before the 3pm? Legal is asking about the rider we flagged this morning.',
    instructions: 'How fast does this need a reply?',
    criteria: SCORE_LEVELS,
    ...(thinking === false ? { thinking } : {}),
  });
  console.timeEnd(label);
  validateScore(label, answer);
}

for (const thinking of [false, undefined]) {
  const label = `noul (thinking ${thinking === false ? 'off' : 'engine default'})`;
  console.time(label);
  const answer = await noul({
    model: model,
    mode: 'system2',
    state: 'I have asked three times now. Can I please just talk to a real person?',
    instructions: 'Is the customer asking for a human agent?',
    criteria: {
      true: 'Explicitly asks for a person, agent or human',
      false: 'No sign of wanting a person',
    },
    ...(thinking === false ? { thinking } : {}),
  });
  console.timeEnd(label);
  validateNoul(label, answer);
}

// Auto: System 1 first; the escalation path stays live whichever way the
// confidence lands. Shape-checked once more, mode-specifics noted.
const auto = await choice({
  ...questionBase,
  mode: 'auto',
  criteria: CHOICE_CRITERIA,
});
validateChoice('auto', auto);

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke failure(s)`);
  process.exitCode = 1;
} else {
  console.log('\nall smoke checks passed');
}
