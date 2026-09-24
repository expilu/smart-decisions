import { choice } from '../src/index.js';

const answer = await choice({
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
  mode: 'system1',
  state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
  instructions: 'Which fruit should I buy?',
  criteria: {
    apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
    banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
    lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
    strawberry: 'Delicious, but moldy within a couple of days',
  },
});

console.log(answer);
