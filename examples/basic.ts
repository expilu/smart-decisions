import { choice } from '../src/index.js';

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

const answer = await choice({
  debug: true,
  model: model,
  mode: 'system1',
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
  criteria: {
    walk: 'Go for a walk',
    movie: 'Watch a movie',
    beach: 'Go to the beach',
  },
});

console.log(answer);
