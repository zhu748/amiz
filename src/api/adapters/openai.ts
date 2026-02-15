import type { LlmAdapter, GenerationInput } from "./base";

export const openAiAdapter: LlmAdapter = {
  provider: "openai",
  async generate({ config, systemPrompt, history, stopSequences }: GenerationInput) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        stop: stopSequences,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content
          }))
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }
};
