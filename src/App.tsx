import { ChangeEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { exportPreset, importCharacterFile, importPresetFile, importWorldBookFile } from "./lib/importers";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useAppStore } from "./store/useAppStore";

const LOBBY_CHAT_KEY = "__lobby__";

function downloadJson(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function messagePreview(text: string): string {
  if (!text) return "暂无消息";
  return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}

export default function App() {
  const {
    userName,
    apiConfig,
    characters,
    worldBooks,
    presets,
    conversations,
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
  const activeMessages = useMemo(
    () => conversations[activeCharacterId ?? LOBBY_CHAT_KEY] ?? [],
    [conversations, activeCharacterId]
  );
  const activeCharacter = useMemo(
    () => characters.find((character) => character.id === activeCharacterId),
    [characters, activeCharacterId]
  );

  const conversationCards = useMemo(() => {
    const lobbyMessages = conversations[LOBBY_CHAT_KEY] ?? [];
    const lobbyLast = lobbyMessages[lobbyMessages.length - 1];
    return [
      {
        key: LOBBY_CHAT_KEY,
        title: "大厅对话",
        count: lobbyMessages.length,
        preview: messagePreview(lobbyLast?.content ?? "")
      },
      ...characters.map((character) => {
        const msgs = conversations[character.id] ?? [];
        const last = msgs[msgs.length - 1];
        return {
          key: character.id,
          title: character.name,
          count: msgs.length,
          preview: messagePreview(last?.content ?? "")
        };
      })
    ];
  }, [characters, conversations]);

  async function onCharacterImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const character = await importCharacterFile(file);
      addCharacter(character);
      setImportError(undefined);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "角色卡导入失败。");
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
      setImportError(error instanceof Error ? error.message : "世界书导入失败。");
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
      setImportError(error instanceof Error ? error.message : "预设导入失败。");
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
        <h1>中文角色扮演前端</h1>

        <section>
          <h2>会话列表</h2>
          <div className="session-list">
            {conversationCards.map((card) => (
              <button
                key={card.key}
                className={activeCharacterId === (card.key === LOBBY_CHAT_KEY ? undefined : card.key) ? "active" : ""}
                onClick={() => selectCharacter(card.key === LOBBY_CHAT_KEY ? undefined : card.key)}
              >
                <div className="session-title">
                  {card.title} <span>{card.count}</span>
                </div>
                <div className="session-preview">{card.preview}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>手机安装</h2>
          <div className="list">
            <button disabled={!canInstall} onClick={() => void install()}>
              {canInstall ? "安装到主屏幕" : isInstalled ? "已安装" : "请用 Chrome 打开安装"}
            </button>
            <p className={`status ${isOnline ? "online" : "offline"}`}>{isOnline ? "在线" : "离线（缓存模式）"}</p>
          </div>
        </section>

        <section>
          <h2>角色卡</h2>
          <input type="file" accept=".json,.png" onChange={onCharacterImport} />
        </section>

        <section>
          <h2>世界书</h2>
          <input type="file" accept=".json" onChange={onWorldBookImport} />
          <div className="list">
            <button className={!activeWorldBookId ? "active" : ""} onClick={() => selectWorldBook(undefined)}>
              不使用世界书
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
          <h2>预设</h2>
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
            导出当前预设
          </button>
        </section>

        <section>
          <h2>模型后端</h2>
          <label>
            用户名
            <input value={userName} onChange={(e) => setUserName(e.target.value)} />
          </label>
          <label>
            提供商
            <select
              value={apiConfig.provider}
              onChange={(e) => updateApiConfig({ provider: e.target.value as "openai" | "claude" | "koboldcpp" })}
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
              placeholder={apiConfig.provider === "koboldcpp" ? "KoboldCPP 可选" : "必填"}
            />
          </label>
          <label>
            模型名
            <input value={apiConfig.model} onChange={(e) => updateApiConfig({ model: e.target.value })} />
          </label>
        </section>

        {importError ? <p className="error">{importError}</p> : null}
        {lastError ? <p className="error">{lastError}</p> : null}
      </aside>

      <main className="chat-panel">
        <header>
          <div>
            <strong>当前会话:</strong> {activeCharacter?.name ?? "大厅对话"}
          </div>
          <div>
            <strong>Token 用量:</strong> {lastPromptTokens} / {activePreset?.maxContextTokens ?? 0}
          </div>
          <div>
            <strong>命中世界书:</strong> {lastLoreInserted.length} 条 / 上下文保留 {lastHistoryCount} 条历史
          </div>
          <button onClick={clearMessages}>清空当前会话</button>
        </header>

        <div className="messages">
          {activeMessages.map((message) => (
            <article key={message.id} className={`msg ${message.role}`}>
              <div className="role">
                {message.role === "user" ? userName : message.role === "assistant" ? activeCharacter?.name ?? "助手" : "系统"}
              </div>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </article>
          ))}
          {activeMessages.length === 0 ? <p className="empty">这个角色还没有对话，开始第一句吧。</p> : null}
        </div>

        <footer>
          <details className="debug-panel">
            <summary>上下文调试</summary>
            <div>
              <strong>触发的世界书条目</strong>
              <ul>
                {lastLoreInserted.length === 0 ? <li>无</li> : null}
                {lastLoreInserted.map((entry, index) => (
                  <li key={`${index}_${entry.slice(0, 12)}`}>{entry}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>System Prompt 预览</strong>
              <pre>{lastSystemPrompt || "还未生成上下文"}</pre>
            </div>
          </details>
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <button disabled={loading || !input.trim()} onClick={() => void onSend()}>
            {loading ? "生成中..." : "发送"}
          </button>
        </footer>
      </main>
    </div>
  );
}
