export interface LLMProvider {
  name: string;
  complete(args: {
    model: string;
    system: string;
    user: string;
    onChunk: (text: string) => void;
  }): Promise<string>;
}
