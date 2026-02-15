import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildContext } from "../lib/contextBuilder";
import { getAdapter } from "../api/adapters";
import type {
  ApiConfig,
  CharacterProfile,
  ChatMessage,
  ChatPreset,
  ProviderKind,
  WorldBook
} from "../types/models";

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

const defaultPreset: ChatPreset = {
  id: uid("preset"),
  name: "Default",
  contextTemplate:
    "Character Description:\n{{description}}\n\nPersonality:\n{{personality}}\n\nScenario:\n{{scenario}}\n\nUser={{user}}\nCharacter={{char}}",
  postHistoryInstructions: "",
  stopSequences: [],
  maxContextTokens: 4096
};

const defaultApiConfig: ApiConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.8
};

interface AppState {
  userName: string;
  apiConfig: ApiConfig;
  characters: CharacterProfile[];
  worldBooks: WorldBook[];
  presets: ChatPreset[];
  messages: ChatMessage[];
  activeCharacterId?: string;
  activeWorldBookId?: string;
  activePresetId: string;
  loading: boolean;
  lastError?: string;
  lastPromptTokens: number;
  lastLoreInserted: string[];
  lastSystemPrompt: string;
  lastHistoryCount: number;
  setUserName: (name: string) => void;
  updateApiConfig: (patch: Partial<ApiConfig>) => void;
  addCharacter: (character: CharacterProfile) => void;
  addWorldBook: (worldBook: WorldBook) => void;
  addPreset: (preset: ChatPreset) => void;
  selectCharacter: (id?: string) => void;
  selectWorldBook: (id?: string) => void;
  selectPreset: (id: string) => void;
  pushMessage: (role: ChatMessage["role"], content: string) => void;
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userName: "User",
      apiConfig: defaultApiConfig,
      characters: [],
      worldBooks: [],
      presets: [defaultPreset],
      messages: [],
      activePresetId: defaultPreset.id,
      loading: false,
      lastPromptTokens: 0,
      lastLoreInserted: [],
      lastSystemPrompt: "",
      lastHistoryCount: 0,
      setUserName(name) {
        set({ userName: name });
      },
      updateApiConfig(patch) {
        set((state) => ({ apiConfig: { ...state.apiConfig, ...patch } }));
      },
      addCharacter(character) {
        set((state) => ({
          characters: [character, ...state.characters],
          activeCharacterId: state.activeCharacterId ?? character.id
        }));
      },
      addWorldBook(worldBook) {
        set((state) => ({
          worldBooks: [worldBook, ...state.worldBooks],
          activeWorldBookId: state.activeWorldBookId ?? worldBook.id
        }));
      },
      addPreset(preset) {
        set((state) => ({
          presets: [preset, ...state.presets],
          activePresetId: preset.id
        }));
      },
      selectCharacter(id) {
        set({ activeCharacterId: id });
      },
      selectWorldBook(id) {
        set({ activeWorldBookId: id });
      },
      selectPreset(id) {
        set({ activePresetId: id });
      },
      pushMessage(role, content) {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: uid("msg"),
              role,
              content,
              createdAt: Date.now()
            }
          ]
        }));
      },
      clearMessages() {
        set({ messages: [] });
      },
      async sendMessage(text) {
        const trimmed = text.trim();
        if (!trimmed) {
          return;
        }

        const userMessage: ChatMessage = {
          id: uid("msg"),
          role: "user",
          content: trimmed,
          createdAt: Date.now()
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          loading: true,
          lastError: undefined
        }));

        try {
          const state = get();
          const character = state.characters.find((item) => item.id === state.activeCharacterId);
          const worldBook = state.worldBooks.find((item) => item.id === state.activeWorldBookId);
          const preset = state.presets.find((item) => item.id === state.activePresetId) ?? defaultPreset;

          if (!state.apiConfig.baseUrl.trim()) {
            throw new Error("Base URL is required.");
          }
          if (!state.apiConfig.model.trim()) {
            throw new Error("Model is required.");
          }
          if (state.apiConfig.provider !== "koboldcpp" && !state.apiConfig.apiKey.trim()) {
            throw new Error("API Key is required for OpenAI/Claude.");
          }

          const context = buildContext({
            userName: state.userName,
            character,
            worldBook,
            preset,
            messages: state.messages
          });
          const adapter = getAdapter(state.apiConfig.provider as ProviderKind);
          const output = await adapter.generate({
            config: state.apiConfig,
            systemPrompt: context.systemPrompt,
            history: context.history,
            stopSequences: preset.stopSequences
          });

          set((next) => ({
            messages: [
              ...next.messages,
              {
                id: uid("msg"),
                role: "assistant",
                content: output || "(empty response)",
                createdAt: Date.now()
              }
            ],
            loading: false,
            lastPromptTokens: context.totalTokens,
            lastLoreInserted: context.loreInserted,
            lastSystemPrompt: context.systemPrompt,
            lastHistoryCount: context.history.length
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown request error";
          set({ loading: false, lastError: message });
        }
      }
    }),
    {
      name: "rp-frontend-store-v1",
      partialize: (state) => ({
        userName: state.userName,
        apiConfig: { ...state.apiConfig, apiKey: "" },
        characters: state.characters,
        worldBooks: state.worldBooks,
        presets: state.presets,
        messages: state.messages,
        activeCharacterId: state.activeCharacterId,
        activeWorldBookId: state.activeWorldBookId,
        activePresetId: state.activePresetId
      })
    }
  )
);
