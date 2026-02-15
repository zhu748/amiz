import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildContext } from "../lib/contextBuilder";
import { getAdapter } from "../api/adapters";
import type {
  ApiConfig,
  CharacterProfile,
  ChatMessage,
  ChatPreset,
  LorebookEntry,
  ProviderKind,
  WorldBook
} from "../types/models";

const LOBBY_CHAT_KEY = "__lobby__";

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

const defaultPreset: ChatPreset = {
  id: uid("preset"),
  name: "默认预设",
  contextTemplate: "角色描述:\n{{description}}\n\n性格:\n{{personality}}\n\n场景:\n{{scenario}}\n\n用户={{user}}\n角色={{char}}",
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
  conversations: Record<string, ChatMessage[]>;
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
  updateCharacter: (id: string, patch: Partial<CharacterProfile>) => void;
  addWorldBook: (worldBook: WorldBook) => void;
  addWorldBookEntry: (worldBookId: string) => void;
  updateWorldBookEntry: (worldBookId: string, entryId: string, patch: Partial<LorebookEntry>) => void;
  removeWorldBookEntry: (worldBookId: string, entryId: string) => void;
  addPreset: (preset: ChatPreset) => void;
  selectCharacter: (id?: string) => void;
  selectWorldBook: (id?: string) => void;
  selectPreset: (id: string) => void;
  getActiveMessages: () => ChatMessage[];
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userName: "用户",
      apiConfig: defaultApiConfig,
      characters: [],
      worldBooks: [],
      presets: [defaultPreset],
      conversations: {
        [LOBBY_CHAT_KEY]: []
      },
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
          activeCharacterId: state.activeCharacterId ?? character.id,
          conversations: {
            ...state.conversations,
            [character.id]: state.conversations[character.id] ?? []
          }
        }));
      },
      updateCharacter(id, patch) {
        set((state) => ({
          characters: state.characters.map((character) =>
            character.id === id ? { ...character, ...patch } : character
          )
        }));
      },
      addWorldBook(worldBook) {
        set((state) => ({
          worldBooks: [worldBook, ...state.worldBooks],
          activeWorldBookId: state.activeWorldBookId ?? worldBook.id
        }));
      },
      addWorldBookEntry(worldBookId) {
        set((state) => ({
          worldBooks: state.worldBooks.map((book) => {
            if (book.id !== worldBookId) return book;
            const entry: LorebookEntry = {
              id: uid("lore"),
              keys: [],
              content: "",
              enabled: true,
              priority: book.entries.length
            };
            return { ...book, entries: [...book.entries, entry] };
          })
        }));
      },
      updateWorldBookEntry(worldBookId, entryId, patch) {
        set((state) => ({
          worldBooks: state.worldBooks.map((book) => {
            if (book.id !== worldBookId) return book;
            return {
              ...book,
              entries: book.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry))
            };
          })
        }));
      },
      removeWorldBookEntry(worldBookId, entryId) {
        set((state) => ({
          worldBooks: state.worldBooks.map((book) => {
            if (book.id !== worldBookId) return book;
            return {
              ...book,
              entries: book.entries.filter((entry) => entry.id !== entryId)
            };
          })
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
      getActiveMessages() {
        const state = get();
        const key = state.activeCharacterId ?? LOBBY_CHAT_KEY;
        return state.conversations[key] ?? [];
      },
      clearMessages() {
        set((state) => ({
          conversations: {
            ...state.conversations,
            [state.activeCharacterId ?? LOBBY_CHAT_KEY]: []
          }
        }));
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
        const conversationKey = get().activeCharacterId ?? LOBBY_CHAT_KEY;

        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversationKey]: [...(state.conversations[conversationKey] ?? []), userMessage]
          },
          loading: true,
          lastError: undefined
        }));

        try {
          const state = get();
          const character = state.characters.find((item) => item.id === state.activeCharacterId);
          const worldBook = state.worldBooks.find((item) => item.id === state.activeWorldBookId);
          const preset = state.presets.find((item) => item.id === state.activePresetId) ?? defaultPreset;

          if (!state.apiConfig.baseUrl.trim()) {
            throw new Error("请填写 Base URL。");
          }
          if (!state.apiConfig.model.trim()) {
            throw new Error("请填写模型名。");
          }
          if (state.apiConfig.provider !== "koboldcpp" && !state.apiConfig.apiKey.trim()) {
            throw new Error("OpenAI / Claude 必须填写 API Key。");
          }

          const activeMessages = state.conversations[conversationKey] ?? [];
          const context = buildContext({
            userName: state.userName,
            character,
            worldBook,
            preset,
            messages: activeMessages
          });
          const adapter = getAdapter(state.apiConfig.provider as ProviderKind);
          const output = await adapter.generate({
            config: state.apiConfig,
            systemPrompt: context.systemPrompt,
            history: context.history,
            stopSequences: preset.stopSequences
          });

          set((next) => ({
            conversations: {
              ...next.conversations,
              [conversationKey]: [
                ...(next.conversations[conversationKey] ?? []),
                {
                  id: uid("msg"),
                  role: "assistant",
                  content: output || "（空回复）",
                  createdAt: Date.now()
                }
              ]
            },
            loading: false,
            lastPromptTokens: context.totalTokens,
            lastLoreInserted: context.loreInserted,
            lastSystemPrompt: context.systemPrompt,
            lastHistoryCount: context.history.length
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "请求失败（未知错误）";
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
        conversations: state.conversations,
        activeCharacterId: state.activeCharacterId,
        activeWorldBookId: state.activeWorldBookId,
        activePresetId: state.activePresetId
      })
    }
  )
);
