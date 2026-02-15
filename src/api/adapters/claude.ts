import type { LlmAdapter, GenerationInput } from "./base";

export const claudeAdapter: LlmAdapter = {
  provider: "claude",
  async generate({ config, systemPrompt, history, stopSequences }: GenerationInput) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        stop_sequences: stopSequences,
        system: systemPrompt,
        max_tokens: 1024,
        messages: history.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content
        }))
      })
    });
    if (!response.ok) {
      throw new Error(`Claude request failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return data.content?.find((item) => item.type === "text")?.text ?? "";
  }
};
