import type { LlmAdapter, GenerationInput } from "./base";

function toPrompt(systemPrompt: string, history: GenerationInput["history"]): string {
  const lines = [systemPrompt];
  for (const message of history) {
    lines.push(`${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`);
  }
  lines.push("Assistant:");
  return lines.join("\n");
}

export const koboldAdapter: LlmAdapter = {
  provider: "koboldcpp",
  async generate({ config, systemPrompt, history, stopSequences }: GenerationInput) {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: toPrompt(systemPrompt, history),
        stop_sequence: stopSequences,
        temperature: config.temperature
      })
    });
    if (!response.ok) {
      throw new Error(`KoboldCPP request failed: ${response.status}`);
    }
    const data = (await response.json()) as { results?: Array<{ text?: string }> };
    return data.results?.[0]?.text ?? "";
  }
};
