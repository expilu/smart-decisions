/** Which mode to answer with. Follows Kahneman's dual-process theory (Thinking, Fast and Slow): System 1 is fast, automatic and instinctive, and costs little in inference (one forward pass, one generated token); System 2 is slow, effortful and deliberate, and more costly (the LLM may reason and has to generate a full structured response). */
export type ChoiceMode = 'system1' | 'system2';

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

export interface ChoiceAnswer {
  /** Option name with the highest probability */
  choice: string;
  /** Full distribution over every option, sums to 1 */
  probabilities: Record<string, number>;
  /** 0..1 — flat distribution → low, single peak → high */
  confidence: number;
}
