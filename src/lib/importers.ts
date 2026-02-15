import { parsePngTextMetadata } from "./pngCardParser";
import type { CharacterCardV2, CharacterProfile, ChatPreset, WorldBook } from "../types/models";

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function toCharacterProfile(v2: CharacterCardV2): CharacterProfile {
  return {
    id: uid("char"),
    name: v2.data.name ?? "Unknown",
    description: v2.data.description ?? "",
    personality: v2.data.personality ?? "",
    scenario: v2.data.scenario ?? "",
    firstMessage: v2.data.first_mes ?? "",
    examples: v2.data.mes_example ?? "",
    systemPrompt: v2.data.system_prompt ?? "",
    postHistoryInstructions: v2.data.post_history_instructions ?? "",
    rawV2: v2
  };
}

function parseCharacterJson(text: string): CharacterCardV2 {
  const parsed = JSON.parse(text) as CharacterCardV2;
  if (!parsed?.data?.name) {
    throw new Error("Invalid V2 character card.");
  }
  return parsed;
}

function decodeBase64Utf8(input: string): string {
  const cleaned = input
    .trim()
    .replace(/^data:.*?;base64,/, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padLength = (4 - (cleaned.length % 4)) % 4;
  const padded = cleaned + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function importCharacterFile(file: File): Promise<CharacterProfile> {
  if (file.name.toLowerCase().endsWith(".json")) {
    const text = await file.text();
    return toCharacterProfile(parseCharacterJson(text));
  }
  if (file.name.toLowerCase().endsWith(".png")) {
    const buffer = await file.arrayBuffer();
    const metadata = parsePngTextMetadata(buffer);
    const rawChara = metadata.chara ?? metadata.character ?? "";
    if (rawChara) {
      const decoded = decodeBase64Utf8(rawChara);
      return toCharacterProfile(parseCharacterJson(decoded));
    }
    for (const value of Object.values(metadata)) {
      try {
        return toCharacterProfile(parseCharacterJson(value));
      } catch {
        // continue searching
      }
    }
    throw new Error("No valid character metadata found in PNG.");
  }
  throw new Error("Unsupported character file type.");
}

export async function importWorldBookFile(file: File): Promise<WorldBook> {
  const parsed = JSON.parse(await file.text()) as {
    name?: string;
    entries?: Array<{
      key?: string[] | string;
      keys?: string[] | string;
      content?: string;
      enabled?: boolean;
      constant?: boolean;
      order?: number;
      comment?: string;
    }>;
  };
  const entries = (parsed.entries ?? []).map((entry, idx) => {
    const keysRaw = entry.keys ?? entry.key ?? [];
    const keys = Array.isArray(keysRaw) ? keysRaw : [keysRaw];
    return {
      id: uid("lore"),
      keys: keys.map((k) => String(k).trim()).filter(Boolean),
      content: entry.content ?? "",
      enabled: entry.enabled ?? !entry.constant,
      priority: entry.order ?? idx,
      comment: entry.comment
    };
  });
  return {
    id: uid("wb"),
    name: parsed.name ?? file.name.replace(/\.json$/i, ""),
    entries,
    raw: parsed
  };
}

export async function importPresetFile(file: File): Promise<ChatPreset> {
  const parsed = JSON.parse(await file.text()) as Partial<ChatPreset>;
  return {
    id: uid("preset"),
    name: parsed.name ?? file.name.replace(/\.json$/i, ""),
    contextTemplate:
      parsed.contextTemplate ??
      "{{description}}\n{{personality}}\nScenario: {{scenario}}\nUser: {{user}}\nCharacter: {{char}}",
    postHistoryInstructions: parsed.postHistoryInstructions ?? "",
    stopSequences: Array.isArray(parsed.stopSequences) ? parsed.stopSequences : [],
    maxContextTokens: parsed.maxContextTokens ?? 4096
  };
}

export function exportPreset(preset: ChatPreset): string {
  return JSON.stringify(preset, null, 2);
}
