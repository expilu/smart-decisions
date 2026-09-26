import type { ChoiceMode } from './choice-mode.js';

export interface Question {
  /** Base url of an OpenAI compatible v1 API, i.e. `'http://localhost:8000/v1'` */
  apiBaseUrl: string;
  /** The API key as required or not by your provider */
  apiKey: string;
  /** The model identifier as required by your API provider. i.e. `'/models/Qwen3.5-4B-Q4_K_M.gguf'` for llama.cpp */
  model: string;
  /** Choose between System 1 or System 2 mode. Defaults to `'system1'` */
  mode?: ChoiceMode;
  /** The state to evaluate */
  // TODO: allow passing objects
  state: string;
  /** The question to answer */
  instructions: string;
  /** The options for the answer. Keys are option names and values are descriptions of the option. i.e. `{ apple: 'Keeps firm on the counter for a week or more, tastes good on its own', banana: 'Cheap and tasty, but ripens to brown in 2-3 days' }` */
  criteria: Record<string, string>;
}
