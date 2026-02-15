import { ChangeEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { exportPreset, importCharacterFile, importPresetFile, importWorldBookFile } from "./lib/importers";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useAppStore } from "./store/useAppStore";

function downloadJson(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const {
    userName,
    apiConfig,
    characters,
    worldBooks,
    presets,
    messages,
    activeCharacterId,
    activeWorldBookId,
    activePresetId,
    loading,
    lastError,
    lastPromptTokens,
    lastLoreInserted,
    lastSystemPrompt,
    lastHistoryCount,
    setUserName,
    updateApiConfig,
    addCharacter,
    addWorldBook,
    addPreset,
    selectCharacter,
    selectWorldBook,
    selectPreset,
    clearMessages,
    sendMessage
  } = useAppStore();

  const [input, setInput] = useState("");
  const [importError, setImportError] = useState<string>();
  const { canInstall, install, isInstalled, isOnline } = usePwaInstall();
  const activePreset = useMemo(() => presets.find((item) => item.id === activePresetId), [presets, activePresetId]);

  async function onCharacterImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const character = await importCharacterFile(file);
      addCharacter(character);
      setImportError(undefined);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Character import failed.");
    } finally {
      event.target.value = "";
    }
  }

  async function onWorldBookImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const worldBook = await importWorldBookFile(file);
      addWorldBook(worldBook);
      setImportError(undefined);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Worldbook import failed.");
    } finally {
      event.target.value = "";
    }
  }

  async function onPresetImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const preset = await importPresetFile(file);
      addPreset(preset);
      setImportError(undefined);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Preset import failed.");
    } finally {
      event.target.value = "";
    }
  }

  async function onSend(): Promise<void> {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await sendMessage(text);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>RP Frontend</h1>
        <section>
          <h2>Android</h2>
          <div className="list">
            <button disabled={!canInstall} onClick={() => void install()}>
              {canInstall ? "Install To Home Screen" : isInstalled ? "Installed" : "Open in Chrome to Install"}
            </button>
            <p className={`status ${isOnline ? "online" : "offline"}`}>
              {isOnline ? "Online" : "Offline (cached mode)"}
            </p>
          </div>
        </section>
        <section>
          <h2>Character</h2>
          <input type="file" accept=".json,.png" onChange={onCharacterImport} />
          <div className="list">
            <button className={!activeCharacterId ? "active" : ""} onClick={() => selectCharacter(undefined)}>
              No Character
            </button>
            {characters.map((character) => (
              <button
                key={character.id}
                className={activeCharacterId === character.id ? "active" : ""}
                onClick={() => selectCharacter(character.id)}
              >
                {character.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>World Info</h2>
          <input type="file" accept=".json" onChange={onWorldBookImport} />
          <div className="list">
            <button className={!activeWorldBookId ? "active" : ""} onClick={() => selectWorldBook(undefined)}>
              No Worldbook
            </button>
            {worldBooks.map((book) => (
              <button
                key={book.id}
                className={activeWorldBookId === book.id ? "active" : ""}
                onClick={() => selectWorldBook(book.id)}
              >
                {book.name} ({book.entries.length})
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Presets</h2>
          <input type="file" accept=".json" onChange={onPresetImport} />
          <div className="list">
            {presets.map((preset) => (
              <button
                key={preset.id}
                className={activePresetId === preset.id ? "active" : ""}
                onClick={() => selectPreset(preset.id)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <button
            disabled={!activePreset}
            onClick={() => {
              if (!activePreset) return;
              downloadJson(`${activePreset.name}.json`, exportPreset(activePreset));
            }}
          >
            Export Active Preset
          </button>
        </section>

        <section>
          <h2>Backend</h2>
          <label>
            User
            <input value={userName} onChange={(e) => setUserName(e.target.value)} />
          </label>
          <label>
            Provider
            <select
              value={apiConfig.provider}
              onChange={(e) =>
                updateApiConfig({ provider: e.target.value as "openai" | "claude" | "koboldcpp" })
              }
            >
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="koboldcpp">KoboldCPP</option>
            </select>
          </label>
          <label>
            Base URL
            <input value={apiConfig.baseUrl} onChange={(e) => updateApiConfig({ baseUrl: e.target.value })} />
          </label>
          <label>
            API Key
            <input
              type="password"
              value={apiConfig.apiKey}
              onChange={(e) => updateApiConfig({ apiKey: e.target.value })}
              placeholder={apiConfig.provider === "koboldcpp" ? "Optional for KoboldCPP" : "Required"}
            />
          </label>
          <label>
            Model
            <input value={apiConfig.model} onChange={(e) => updateApiConfig({ model: e.target.value })} />
          </label>
        </section>

        {importError ? <p className="error">{importError}</p> : null}
        {lastError ? <p className="error">{lastError}</p> : null}
      </aside>

      <main className="chat-panel">
        <header>
          <div>
            <strong>Token Usage:</strong> {lastPromptTokens} / {activePreset?.maxContextTokens ?? 0}
          </div>
          <div>
            <strong>Lore Triggered:</strong> {lastLoreInserted.length}
          </div>
          <div>
            <strong>History In Window:</strong> {lastHistoryCount}
          </div>
          <button onClick={clearMessages}>Clear Chat</button>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <article key={message.id} className={`msg ${message.role}`}>
              <div className="role">{message.role}</div>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </article>
          ))}
        </div>

        <footer>
          <details className="debug-panel">
            <summary>Context Debug</summary>
            <div>
              <strong>Triggered lore entries</strong>
              <ul>
                {lastLoreInserted.length === 0 ? <li>None</li> : null}
                {lastLoreInserted.map((entry, index) => (
                  <li key={`${index}_${entry.slice(0, 12)}`}>{entry}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>System prompt preview</strong>
              <pre>{lastSystemPrompt || "(No prompt generated yet)"}</pre>
            </div>
          </details>
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type message..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <button disabled={loading || !input.trim()} onClick={() => void onSend()}>
            {loading ? "Generating..." : "Send"}
          </button>
        </footer>
      </main>
    </div>
  );
}
