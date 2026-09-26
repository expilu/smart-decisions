import { choice } from '../src/index.js';

const criteria = {
  billing: 'Customer asks about invoices, payments, refunds or charges',
  technical: 'Customer reports a bug, error or product malfunction',
  sales: 'Customer asks about pricing, plans or upgrading',
  account: 'Customer needs help with login or account access',
};

const ticket = 'Hi, I was charged twice this month. Can you refund the extra payment?';

async function main() {
  const answer = await choice({
    apiBaseUrl: process.env.API_BASE_URL!,
    apiKey: process.env.API_KEY!,
    model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
    mode: 'system1',
    state: `Customer support ticket:\n"${ticket}"`,
    instructions: 'Classify the ticket into the right department',
    criteria,
  });

  if (answer.confidence < 0.5) {
    console.log('Too unsure to act autonomously, escalate to a human:', answer);
    return;
  }

  console.log(`Route to: ${answer.choice}`);
  console.log(answer);
}

void main();
