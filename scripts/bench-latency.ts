/**
 * Latency benchmark
 *
 * Measures the full round trip of every primitive with the library's own
 * public API, System 1 first and System 2 (thinking off / engine default)
 * and the 'auto' escalation after it. Sequential calls, warmup discarded,
 * per-primitive stats.
 *
 * System 2 answers take seconds, so it runs fewer rounds than System 1's
 * 100 — the stats format stays identical.
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

// The System 2 variants ask the same questions, so the numbers measure what
// the README claims per mode. `thinking` steering shows the deliberation tax.
const SYSTEM2_BENCHES = {
  'choice system2 (thinking off)': () =>
    choice({
      model,
      mode: 'system2',
      thinking: false,
      state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
      instructions: 'Which fruit should I buy?',
      criteria: {
        apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
        banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
        lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
        strawberry: 'Delicious, but moldy within a couple of days',
      },
    }),
  'choice system2 (thinking engine default)': () =>
    choice({
      model,
      mode: 'system2',
      // Bench hygiene: a thinking model can stall minutes on one round
      // (observed >5 min against the reference server, cut by the HTTP layer
      // — real callers get the same protection from their own timeoutMs).
      // Cap the round and let the round be skipped rather than stall the run.
      maxRetries: 0,
      timeoutMs: 120_000,
      state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
      instructions: 'Which fruit should I buy?',
      criteria: {
        apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
        banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
        lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
        strawberry: 'Delicious, but moldy within a couple of days',
      },
    }),
  'noul system2 (thinking off)': () =>
    noul({
      model,
      mode: 'system2',
      thinking: false,
      maxRetries: 0,
      timeoutMs: 120_000,
      state: 'I have asked three times now. Can I please just talk to a real person?',
      instructions: 'Is the customer asking for a human agent?',
    }),
  'score auto (escalates only low-confidence verdicts)': () =>
    score({
      model,
      mode: 'auto',
      maxRetries: 0,
      timeoutMs: 120_000,
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
  'noul auto (escalates split verdicts)': () =>
    noul({
      model,
      mode: 'auto',
      maxRetries: 0,
      timeoutMs: 120_000,
      state: 'I have asked three times now. Can I please just talk to a real person?',
      instructions: 'Is the customer asking for a human agent?',
    }),
};

const WARMUP = 5;
const ROUNDS = 100;
/** System 2 answers take seconds: fewer rounds, same stats format. */
const SYSTEM2_ROUNDS = 30;

function stats(samples: number[]): string {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return `mean ${mean.toFixed(0)} ms · median ${pct(0.5).toFixed(0)} ms · p95 ${pct(0.95).toFixed(0)} ms · min ${sorted[0].toFixed(0)} ms · max ${sorted.at(-1)!.toFixed(0)} ms (n=${samples.length})`;
}

function benchmark(name: string, run: () => Promise<unknown>, rounds: number): Promise<void> {
  return (async () => {
    for (let i = 0; i < WARMUP; i++) {
      try {
        await run(); // warm the server and the network path; discarded
      } catch (err) {
        // A warmup failure is usually a transient server stall (a thinking
        // model can run for minutes); a warned warmup keeps bench resilient.
        console.warn(`# ${name}: warmup ${i + 1} failed (${String(err).slice(0, 60)})`);
      }
    }
    const samples: number[] = [];
    let skipped = 0;
    for (let i = 0; i < rounds; i++) {
      const start = performance.now();
      try {
        const answer = await run();
        const ms = performance.now() - start;
        if (!answer) throw new Error('returned nothing');
        samples.push(ms);
      } catch (err) {
        // Outliers (server stalls, retries exhausting) are counted as skipped,
        // not fatal: a stall says the model loops, not that the library lies.
        skipped++;
        console.warn(`# ${name}: round ${i + 1} skipped (${String(err).slice(0, 60)})`);
      }
    }
    if (samples.length === 0) {
      console.log(`### ${name}: no successful rounds (all ${skipped} skipped)`);
      return;
    }
    const skips = skipped ? ` [+${skipped} skipped]` : '';
    console.log(`### ${name}: ${stats(samples)}${skips}`);
  })();
}

for (const [name, run] of Object.entries(BENCHES)) {
  await benchmark(name, run, ROUNDS);
}
for (const [name, run] of Object.entries(SYSTEM2_BENCHES)) {
  await benchmark(name, run, SYSTEM2_ROUNDS);
}
