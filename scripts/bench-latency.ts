/**
 * Latency benchmark
 *
 * Measures the full round trip of every System 1 primitive with the library's own
 * public API.
 * Sequential calls, warmup discarded, per-primitive stats.
 *
 * Usage: npm run bench:latency  (needs .env with API_BASE_URL / API_KEY)
 */

import { choice, score, noul } from '../src/index.js';

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

/**
 * Same shapes the README documents, so the numbers measure what the README claims.
 */
const BENCHES = {
  choice: () =>
    choice({
      model,
      mode: 'system1',
      state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
      instructions: 'Which fruit should I buy?',
      criteria: {
        apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
        banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
        lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
        strawberry: 'Delicious, but moldy within a couple of days',
      },
    }),
  score: () =>
    score({
      model,
      state:
        'Can you hop on a quick call before the 3pm? Legal is asking about the rider we flagged this morning.',
      instructions: 'How fast does this need a reply?',
      criteria: [
        'No rush; whenever there is a spare moment',
        'Within the week is fine',
        'Before the day ends',
        'Within the hour',
        'Right now, drop everything',
      ],
    }),
  noul: () =>
    noul({
      model,
      state: 'I have asked three times now. Can I please just talk to a real person?',
      instructions: 'Is the customer asking for a human agent?',
    }),
};

const WARMUP = 5;
const ROUNDS = 100;

function stats(samples: number[]): string {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return `mean ${mean.toFixed(0)} ms · median ${pct(0.5).toFixed(0)} ms · p95 ${pct(0.95).toFixed(0)} ms · min ${sorted[0].toFixed(0)} ms · max ${sorted.at(-1)!.toFixed(0)} ms (n=${samples.length})`;
}

for (const [name, run] of Object.entries(BENCHES)) {
  for (let i = 0; i < WARMUP; i++) {
    await run(); // warm the server and the network path; discarded
  }
  const samples: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const start = performance.now();
    const answer = await run();
    const ms = performance.now() - start;
    if (!answer) throw new Error(`${name} returned nothing on round ${i}`);
    samples.push(ms);
  }
  console.log(`### ${name}: ${stats(samples)}`);
}
