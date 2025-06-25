export interface ModelClient {
  /**
   * Generates a text completion for a given prompt.
   * @param opts - The generation options.
   * @param opts.prompt - The input prompt.
   * @param opts.json - Whether to request a JSON object as output.
   * @returns The generated text content.
   */
  generate(opts: { prompt: string; json?: boolean }): Promise<string>;
}
