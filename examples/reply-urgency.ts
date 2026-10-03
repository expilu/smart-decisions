import { score } from '../src/index.js';

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

const criteria = [
  'No rush; whenever there is a spare moment',
  'Within the week is fine',
  'Before the day ends',
  'Within the hour',
  'Right now, drop everything',
];

const answer = await score({
  debug: true,
  model: model,
  mode: 'system1',
  state:
    'Can you hop on a quick call before the 3pm? Legal is asking about the rider we flagged this morning.',
  instructions: 'How fast does this need a reply?',
  criteria,
});

console.log(answer);

// A score can land between two levels: it is the probability-weighted mean of
// the level numbers, so 2.43 means between "before the day ends" and "within
// the hour", leaning to the first.
const top = criteria.length - 1;
if (answer.confidence < 0.3) {
  console.log('No clear placement — read the probabilities by hand above.');
} else {
  console.log(`Position on the urgency spectrum: ${answer.score} of ${top}`);
}
