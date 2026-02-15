export type Id = string;

export interface CharacterCardV2 {
  spec: "chara_card_v2" | string;
  spec_version: string;
  data: {
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, unknown>;
  };
}

export interface CharacterProfile {
  id: Id;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  examples: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  rawV2: CharacterCardV2;
}

export interface LorebookEntry {
  id: Id;
  keys: string[];
  content: string;
  enabled: boolean;
  priority: number;
  comment?: string;
}

export interface WorldBook {
  id: Id;
  name: string;
  entries: LorebookEntry[];
  raw: unknown;
}

export interface ChatPreset {
  id: Id;
  name: string;
  contextTemplate: string;
  postHistoryInstructions: string;
  stopSequences: string[];
  maxContextTokens: number;
}

export interface ChatMessage {
  id: Id;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: number;
}

export type ProviderKind = "openai" | "claude" | "koboldcpp";

export interface ApiConfig {
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}
