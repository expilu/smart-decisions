import { choice } from '../src/index.js';

const criteria = {
  billing: 'Customer asks about invoices, payments, refunds or charges',
  technical: 'Customer reports a bug, error or product malfunction',
  sales: 'Customer asks about pricing, plans or upgrading',
  account: 'Customer needs help with login or account access',
};

const tickets = [
  'Hi, I was charged twice this month. Can you refund the extra payment?',
  'Every time I open the app it crashes after ~10 seconds on my tablet.',
  'What is included in the family plan? Can I upgrade from my current one?',
];

const model = {
  apiBaseUrl: process.env.API_BASE_URL!,
  apiKey: process.env.API_KEY!,
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

// mode 'auto': System 1 answers first (one forward pass, milliseconds), and
// only a low-confidence System 1 verdict escalates to System 2, where the
// model deliberates and rates the options in a structured reply. The answer
// shape is identical either way — your code does not know which pass won.
for (const ticket of tickets) {
  const answer = await choice({
    debug: true,
    model: model,
    mode: 'auto',
    // Confidence-equivalent under which a System 1 verdict is "too unsure"
    // and escalates. Default 0.7; shown here so it is discoverable. Applies
    // only to 'auto' mode.
    autoModeThreshold: 0.7,
    state: `Customer support ticket:\n"${ticket}"`,
    instructions: 'Classify the ticket into the right department',
    criteria,
  });

  console.log(`Route to: ${answer.choice}`);
  console.log(answer);
}
