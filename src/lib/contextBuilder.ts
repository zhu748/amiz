import { applyTemplate } from "./template";
import { estimateMessagesTokens, estimateTokens } from "./token";
import type { CharacterProfile, ChatMessage, ChatPreset, WorldBook } from "../types/models";

export interface BuildContextParams {
  userName: string;
  character?: CharacterProfile;
  worldBook?: WorldBook;
  preset: ChatPreset;
  messages: ChatMessage[];
}

function triggerLoreEntries(worldBook: WorldBook | undefined, sourceText: string): string[] {
  if (!worldBook) {
    return [];
  }
  const normalized = sourceText.toLowerCase();
  const hits = worldBook.entries
    .filter((entry) => {
      if (!entry.enabled || !entry.content.trim()) {
        return false;
      }
      return entry.keys.some((key) => normalized.includes(key.toLowerCase()));
    })
    .sort((a, b) => a.priority - b.priority)
    .map((entry) => entry.content.trim());
  return [...new Set(hits)];
}

export function buildContext(params: BuildContextParams): {
  systemPrompt: string;
  history: ChatMessage[];
  loreInserted: string[];
  totalTokens: number;
} {
  const { userName, character, worldBook, preset, messages } = params;
  const vars = {
    user: userName,
    char: character?.name ?? "Assistant",
    description: character?.description ?? "",
    personality: character?.personality ?? "",
    scenario: character?.scenario ?? ""
  };

  const templateContext = applyTemplate(preset.contextTemplate, vars).trim();
  const sourceForTrigger = messages.map((m) => m.content).join("\n");
  const loreInserted = triggerLoreEntries(worldBook, sourceForTrigger);
  const postHistoryInstructions =
    character?.postHistoryInstructions || preset.postHistoryInstructions || "";

  const systemParts = [character?.systemPrompt ?? "", templateContext, ...loreInserted, postHistoryInstructions]
    .map((item) => item.trim())
    .filter(Boolean);
  const systemPrompt = systemParts.join("\n\n");

  const history: ChatMessage[] = [];
  const reversed = [...messages].reverse();
  let budget = Math.max(512, preset.maxContextTokens - estimateTokens(systemPrompt));
  for (const message of reversed) {
    const cost = estimateTokens(message.content);
    if (cost <= budget) {
      history.push(message);
      budget -= cost;
    } else {
      break;
    }
  }
  history.reverse();
  const totalTokens = estimateTokens(systemPrompt) + estimateMessagesTokens(history);

  return {
    systemPrompt,
    history,
    loreInserted,
    totalTokens
  };
}
