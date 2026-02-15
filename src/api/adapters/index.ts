import type { LlmAdapter } from "./base";
import { claudeAdapter } from "./claude";
import { koboldAdapter } from "./kobold";
import { openAiAdapter } from "./openai";

const adapters: LlmAdapter[] = [openAiAdapter, claudeAdapter, koboldAdapter];

export function getAdapter(provider: LlmAdapter["provider"]): LlmAdapter {
  const adapter = adapters.find((item) => item.provider === provider);
  if (!adapter) {
    throw new Error(`No adapter for provider: ${provider}`);
  }
  return adapter;
}
