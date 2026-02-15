import type { ApiConfig, ChatMessage, ProviderKind } from "../../types/models";

export interface GenerationInput {
  config: ApiConfig;
  systemPrompt: string;
  history: ChatMessage[];
  stopSequences: string[];
}

export interface LlmAdapter {
  provider: ProviderKind;
  generate(input: GenerationInput): Promise<string>;
}
