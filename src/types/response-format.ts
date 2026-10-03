/**
 * The `response_format` field of an OpenAI-compatible chat completions request,
 * carrying a JSON Schema the engine should enforce on its output.
 *
 * Engines interpret this at their own depth — hosted OpenAI validates the body
 * and (with `strict`) guarantees schema conformity, local engines convert to a
 * grammar (llama.cpp GBNF, vLLM xgrammar), some ignore the field entirely. The
 * library therefore pairs it with prompt-level schema instructions and a
 * parse/validate/retry fallback instead of trusting it alone.
 */
export interface ChatCompletionResponseFormat {
  /**
   * How to shape the output. `'json_schema'` is the structured-output request
   * the whole System 2 mode relies on
   */
  type: 'json_schema';
  /**
   * The schema itself. Engines can only enforce what a JSON Schema can say;
   * anything else lives (redundantly, on purpose) in the prompt instructions
   */
  json_schema: {
    /**
     * A name for the schema — some engines use it to cache grammars or label
     * their responses; anything short and stable works. i.e. `'ratings'`
     */
    name: string;
    /**
     * The JSON Schema object in the API's own wire format. Written
     * strict-compatible across engines so the same document works everywhere
     * (`additionalProperties: false`, every property in `required`)
     */
    schema: Record<string, unknown>;
    /**
     * Hosted OpenAI rejects schemas not marked strict, and keeps the strict
     * semantics on other engines; engines that lack the flag ignore the extra
     * key
     */
    strict: true;
  };
}
