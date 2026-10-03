import { noul } from '../src/index.js';

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

// The same yes/no judgment System 1's noul example makes, but deliberately:
// the model reasons about the message and rates both readings 0..10 before
// the ratio becomes the "yes" probability. `thinking: false` keeps it fast
// while still getting the structured, deliberate readout.
const YES = 0.8;
const NO = 0.2;

const answer = await noul({
  debug: true,
  model: model,
  mode: 'system2',
  thinking: false,
  state: 'I have asked three times now. Can I please just talk to a real person?',
  instructions: 'Is the customer asking for a human agent?',
  criteria: {
    true: 'Explicitly asks for a person, agent or human',
    false: 'No sign of wanting a person',
  },
});

console.log(answer);

if (NO < answer.noul && answer.noul < YES) {
  console.log('The model split itself — send to review instead of either code path.');
} else if (answer.noul >= YES) {
  console.log(`Yes (${answer.noul}) — route to a human agent.`);
} else {
  console.log(`No (${answer.noul}) — keep it with the bot.`);
}
