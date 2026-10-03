import { choice } from '../src/index.js';

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

// System 2 is the deliberate answer: the model reasons and rates every option
// 0..10 in a structured reply, and the ratings become the same probability
// distribution and confidence System 1 returns. Slower (seconds), hopefully
// more accurate.
const answer = await choice({
  debug: true,
  model: model,
  mode: 'system2',
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
  criteria: {
    walk: 'Go for a walk',
    movie: 'Watch a movie',
    beach: 'Go to the beach',
  },
});

console.log(answer);

// `thinking: false` skips the model's reasoning trace when the model can:
// the same request without it deliberates first and costs several times more.
const withoutThinking = await choice({
  debug: true,
  model: model,
  mode: 'system2',
  thinking: false,
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
  criteria: {
    walk: 'Go for a walk',
    movie: 'Watch a movie',
    beach: 'Go to the beach',
  },
});

console.log(withoutThinking);
