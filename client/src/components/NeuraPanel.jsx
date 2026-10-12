import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquarePlus,
  History,
  Send,
  Sparkles,
  Code2,
  Bug,
  Zap,
  Terminal,
  Eraser,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  LoaderCircle
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { readStorage, writeStorage } from '../utils/storage';
import { getThemeClasses } from '../utils/theme';
import {
  chatWithNeura,
  createNeuraConversation,
  getNeuraConversation,
  getNeuraConversationHistory,
  deleteNeuraConversation
} from '../services/aiService';
import { copyText } from '../utils/clipboard';

const PANEL_WIDTH_KEY = 'synapse-neura-width';
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 720;

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function CodeBlock({ inline, className, children, theme }) {
  const [copied, setCopied] = useState(false);
  const match = /language-([\w-]+)/.exec(className || '');
  const language = match?.[1] || 'code';
  const code = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code className="select-text px-1.5 py-0.5 rounded-md font-mono text-[11px] border bg-(--ink)/5 text-(--ink) border-(--line)">
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      const didCopy = await copyText(code);
      if (!didCopy) {
        throw new Error('Copy failed');
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-(--line) bg-(--paper)">
      <div className="flex items-center justify-between px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] border-b border-(--line) text-(--muted)">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 normal-case tracking-normal transition-colors cursor-pointer ${
            copied
              ? 'text-emerald-600'
              : 'text-(--muted) hover:bg-(--ink)/5 hover:text-(--ink)'
          }`}
          title="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span className="text-[11px] font-medium">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 custom-scrollbar select-text">
        <code className="font-mono text-[11.5px] leading-6 select-text text-(--ink)">
          {code}
        </code>
      </pre>
    </div>
  );
}

function AssistantMessage({ content, theme }) {
  return (
    <div className={`select-text prose prose-sm max-w-none wrap-break-word prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-inherit ${
      theme === 'dark' ? 'prose-invert' : 'prose-slate'
    }`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className="warp-break-word whitespace-pre-wrap m-0 select-text">{children}</p>;
          },
          li({ children }) {
            return <li className="warp-break-word select-text">{children}</li>;
          },
          code({ inline, className, children }) {
            return (
              <CodeBlock inline={inline} className={className} theme={theme}>
                {children}
              </CodeBlock>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Explain Code', prompt: 'Explain the current code', Icon: Zap, primary: true },
  { label: 'Find Bugs', prompt: 'Find bugs in the current code', Icon: Bug, primary: false },
  { label: 'Refactor', prompt: 'Refactor the current code', Icon: Code2, primary: false },
];

export default function NeuraPanel({ theme, forceOpen = false, onClose }) {
  const { files, activeFile } = useFiles();
  const t = getThemeClasses(theme);
  const panelRef = useRef(null);
  const resizeStateRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const actuallyOpen = forceOpen || isOpen;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };
  const [panelWidth, setPanelWidth] = useState(() => {
    const savedWidth = Number(readStorage(PANEL_WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth >= MIN_PANEL_WIDTH && savedWidth <= MAX_PANEL_WIDTH) {
      return savedWidth;
    }
    return 400;
  });

  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'history'

  useEffect(() => {
    writeStorage(PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextWidth = resizeState.startWidth + (resizeState.startX - event.clientX);
      const boundedWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, nextWidth));
      setPanelWidth(boundedWidth);
    };

    const stopResizing = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isSending, activeConversationId, activeTab]);

  const startResizing = (event) => {
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: panelWidth,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const fileContext = useMemo(
    () => ({
      activeFile: activeFile
        ? {
            id: activeFile.id,
            name: activeFile.name,
            content: activeFile.content,
          }
        : null,
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
      })),
    }),
    [activeFile, files]
  );

  const upsertConversation = (conversation, options = {}) => {
    if (!conversation?._id) return;

    setConversations((current) => {
      const filtered = current.filter((entry) => entry._id !== conversation._id);
      const next = [conversation, ...filtered];
      if (options.keepOrder) {
        return next;
      }
      return next.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    });
  };

  const loadConversationList = async () => {
    setIsLoadingHistory(true);
    setError('');

    try {
      const history = await getNeuraConversationHistory();
      setConversations(history);

      if (history.length > 0) {
        setActiveConversationId(history[0]._id);
        setIsLoadingConversation(true);
        const conversationData = await getNeuraConversation(history[0]._id);
        setMessages(conversationData.messages || []);
      } else {
        setActiveConversationId(null);
        setMessages([
          {
            _id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm Neura AI. I've indexed your current workspace. How can I help you today?",
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to load conversation history.');
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingConversation(false);
    }
  };

  useEffect(() => {
    if (!actuallyOpen || hasLoadedRef.current) return;

    hasLoadedRef.current = true;
    loadConversationList();
  }, [actuallyOpen]);

  const handleLoadConversation = async (conversationId) => {
    if (!conversationId || conversationId === activeConversationId) return;

    setIsLoadingConversation(true);
    setError('');

    try {
      const data = await getNeuraConversation(conversationId);
      setActiveConversationId(conversationId);
      setMessages(data.messages || []);
      if (data.conversation) {
        upsertConversation(data.conversation, { keepOrder: true });
      }
      setActiveTab('chat');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load that conversation.');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleNewChat = async () => {
    setIsCreatingConversation(true);
    setError('');

    try {
      const conversation = await createNeuraConversation();
      setActiveConversationId(conversation._id);
      setMessages([
          {
            _id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm Neura AI. I've indexed your current workspace. How can I help you today?",
            createdAt: new Date().toISOString()
          }
      ]);
      setInputValue('');
      upsertConversation(conversation);
      setActiveTab('chat');
    } catch (requestError) {
      setError(requestError.message || 'Unable to start a new chat.');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const deleteHistoryItem = async (e, conversationId) => {
    e.stopPropagation();
    try {
      await deleteNeuraConversation(conversationId);
      setConversations(prev => prev.filter(c => c._id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([
          {
            _id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm Neura AI. I've indexed your current workspace. How can I help you today?",
            createdAt: new Date().toISOString()
          }
        ]);
        setActiveTab('chat');
      }
    } catch {
      setError('Failed to delete conversation');
    }
  };

  const handleSend = async (messageOverride = null) => {
    const messageToSend = messageOverride !== null && typeof messageOverride === 'string' ? messageOverride : inputValue;
    const trimmedMessage = String(messageToSend || '').trim();
    if (!trimmedMessage || isSending) return;

    const optimisticUserMessage = {
      _id: `temp-user-${Date.now()}`,
      role: 'user',
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current.filter(m => m._id !== 'welcome'), optimisticUserMessage]);
    setInputValue('');
    setIsSending(true);
    setError('');

    try {
      const response = await chatWithNeura({
        message: trimmedMessage,
        conversationId: activeConversationId,
        context: fileContext,
      });

      setActiveConversationId(response.conversationId);
      if (response.conversation) {
        upsertConversation(response.conversation);
      }

      setMessages((current) => {
        const withoutOptimistic = current.filter((entry) => entry._id !== optimisticUserMessage._id);
        return [
          ...withoutOptimistic,
          response.userMessage || optimisticUserMessage,
          response.assistantMessage || {
            _id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.reply,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    } catch (requestError) {
      setMessages((current) => current.filter((entry) => entry._id !== optimisticUserMessage._id));
      setError(requestError.message || 'Neura could not respond right now.');
    } finally {
      setIsSending(false);
    }
  };

  // ─── Collapsed rail ────────────────────────────────────────────────
  // External triggers (e.g. "Explain with Neura" from the output panel):
  // open the panel and send the prompt as a chat message.
  const handleSendRef = useRef(null);
  handleSendRef.current = handleSend;
  useEffect(() => {
    const onAskNeura = (e) => {
      const prompt = e?.detail?.prompt;
      if (!prompt || typeof prompt !== 'string') return;
      setIsOpen(true);
      // Defer a tick so the panel opens before the message streams in.
      setTimeout(() => handleSendRef.current?.(prompt), 60);
    };
    window.addEventListener('synapse:ask-neura', onAskNeura);
    return () => window.removeEventListener('synapse:ask-neura', onAskNeura);
  }, []);

  if (!actuallyOpen) {
    return (
      <div className="w-12 rounded-lg border flex flex-col items-center py-3 shrink-0 bg-(--paper-2) border-(--line)">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-md border transition-colors duration-150 cursor-pointer bg-(--blue)/10 border-(--blue)/30 text-(--blue) hover:bg-(--blue)/20"
          title="Open Neura AI Assistant"
        >
          <Sparkles size={16} />
        </button>
        <span className="mt-2 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-(--muted) [writing-mode:vertical-rl]">
          Neura
        </span>
      </div>
    );
  }

  return (
    <aside
      ref={panelRef}
      style={forceOpen ? undefined : { width: `${panelWidth}px` }}
      className={`relative flex flex-col shrink-0 rounded-lg overflow-hidden min-w-0 border animate-fade-in bg-(--paper-2) border-(--line) ${forceOpen ? 'w-full h-full rounded-none' : 'transition-[width] duration-200'}`}
    >
      {!forceOpen && (
        <button
          type="button"
          aria-label="Resize Neura panel"
          onPointerDown={startResizing}
          className="absolute left-0 top-0 z-20 h-full w-1.5 -translate-x-1/2 cursor-col-resize transition-colors hover:bg-(--ink)/8"
        >
          <span className="sr-only">Resize</span>
        </button>
      )}

      <div className="flex flex-col w-full h-full relative min-h-0">
        {/* Header */}
        <header className={`px-4 py-3 border-b ${t.border} flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex w-8 h-8 rounded-md border items-center justify-center bg-(--blue)/10 border-(--blue)/30">
              <Sparkles size={15} className="text-(--blue)" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 rounded-full border-(--paper-2)" />
            </span>
            <div>
              <h2 className={`text-sm font-extrabold ${t.textPrimary}`}>
                Neura AI
              </h2>
              <p className={`font-mono text-[10px] ${t.textMuted} flex items-center gap-1`}>
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              className={t.iconBtn + ' p-1.5!'}
              title="New Chat"
              onClick={handleNewChat}
              disabled={isCreatingConversation || isSending}
            >
              {isCreatingConversation ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClose}
              className={t.iconBtn + ' p-1.5!'}
              title="Close Panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Quick actions */}
        <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b ${t.border} overflow-x-auto shrink-0`}>
          {QUICK_ACTIONS.map(({ label, prompt, Icon, primary }) => (
            <button
              key={label}
              onClick={() => handleSend(prompt)}
              disabled={isSending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none border ${
                primary
                  ? 'bg-(--blue)/10 text-(--blue) border-(--blue)/30 hover:bg-(--blue)/15'
                  : 'bg-(--ink)/3 text-(--muted) border-(--line) hover:bg-(--ink)/6 hover:text-(--ink)'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Chat / History tabs */}
        <div className={`flex px-4 gap-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] border-b ${t.border} shrink-0 ${t.textMuted}`}>
          {['chat', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-2.5 transition-colors cursor-pointer ${
                activeTab === tab ? 'text-(--ink)' : 'hover:text-(--muted)'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-(--blue)" />
              )}
            </button>
          ))}
        </div>

        {/* Messages */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar min-w-0 min-h-0">
          {activeTab === 'chat' ? (
            <>
              {isLoadingConversation ? (
                <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-[11px] mx-auto mt-4 animate-fade-in ${t.card}`}>
                  <LoaderCircle size={13} className="animate-spin" />
                  <span className={t.textMuted}>Loading conversation…</span>
                </div>
              ) : messages.map((msg) => {
                const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const isUser = msg.role === 'user';
                return (
                  <div key={msg._id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in w-full`}>
                    <div className="flex items-center gap-1.5 mb-1.5 px-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-(--muted)">
                      {!isUser && <Sparkles size={9} className="text-(--blue)" />}
                      <span>{isUser ? 'You' : 'Neura AI'}</span>
                      {timeStr && <span className="normal-case font-medium opacity-70">{timeStr}</span>}
                    </div>

                    <div className={`max-w-[92%] px-4 py-3 rounded-lg text-[13px] leading-relaxed wrap-break-word overflow-hidden border ${
                      isUser
                        ? 'bg-(--ink) text-(--paper) border-(--ink)'
                        : 'bg-(--paper) text-(--ink) border-(--line)'
                    }`}>
                      {isUser ? (
                        <div className="whitespace-pre-wrap select-text">{msg.content}</div>
                      ) : (
                        <AssistantMessage content={msg.content} theme={theme} />
                      )}

                      {msg.role === 'assistant' && msg._id === 'welcome' && (activeFile || files.length > 0) && (
                        <div className="mt-3 px-2.5 py-1.5 rounded-md border font-mono text-[10px] flex items-center justify-between gap-2 bg-(--ink)/3 border-(--line) text-(--muted)">
                          <span className="truncate">Context: {activeFile ? activeFile.name : 'Workspace'}</span>
                          <Terminal size={11} className="shrink-0 opacity-60" />
                        </div>
                      )}
                    </div>

                    {msg.role === 'assistant' && msg._id !== 'welcome' && (
                      <button
                        onClick={() => copyText(msg.content)}
                        className="mt-1.5 ml-1 p-1.5 rounded-md opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer text-(--muted) hover:bg-(--ink)/6 hover:text-(--ink)"
                        title="Copy response"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex flex-col items-start animate-fade-in w-full">
                  <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-(--muted)">
                    <Sparkles size={9} className="text-(--blue)" />
                    <span>Neura AI</span>
                  </div>
                  <div className="px-5 py-4 rounded-lg border border-(--line) bg-(--paper)">
                    <span className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-(--blue) animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-(--blue) animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-(--blue) animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-[11px] rounded-lg border px-3.5 py-2.5 animate-fade-in border-(--red)/30 text-(--red) bg-(--red)/7">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} className="h-2 w-full" />
            </>
          ) : (
            <div className="space-y-1.5">
              {isLoadingHistory ? (
                <div className={`flex items-center justify-center gap-2 py-8 text-[11px] ${t.textMuted}`}>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>Loading chats…</span>
                </div>
              ) : conversations.length > 0 ? (
                conversations.map((item) => {
                  const isActive = item._id === activeConversationId;
                  return (
                    <div key={item._id} className="relative group/item animate-fade-in">
                      <button
                        onClick={() => handleLoadConversation(item._id)}
                        className={`w-full flex items-center justify-between pl-3 pr-10 py-2.5 rounded-md text-left transition-colors duration-150 cursor-pointer border ${
                          isActive
                            ? 'bg-(--blue)/8 border-(--blue)/30'
                            : 'border-transparent hover:bg-(--ink)/4'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <History size={13} className={isActive ? 'text-(--blue) shrink-0' : 'text-(--muted) shrink-0'} />
                          <span className={`text-[13px] truncate ${isActive ? t.textPrimary + ' font-medium' : t.textSecondary}`}>
                            {item.title}
                          </span>
                        </span>
                        <span className={`text-[10px] font-mono ${t.textMuted} whitespace-nowrap shrink-0 ml-2 group-hover/item:hidden`}>
                          {formatConversationTime(item.updatedAt)}
                        </span>
                      </button>

                      <button
                        onClick={(e) => deleteHistoryItem(e, item._id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover/item:opacity-100 rounded-md transition-colors cursor-pointer z-10 hover:bg-(--red)/10 text-(--muted) hover:text-(--red)"
                        title="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className={`flex flex-col items-center justify-center py-12 gap-2 animate-fade-in ${t.textMuted}`}>
                  <History size={30} />
                  <p className="text-xs">No chat history yet</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer input */}
        {activeTab === 'chat' && (
          <footer className={`p-3.5 border-t ${t.border} shrink-0`}>
            <div className="relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                maxLength={4000}
                placeholder="Ask Neura anything…"
                rows={3}
                className={`${t.input} w-full min-h-22 p-3 pr-12 text-[13px] resize-none leading-relaxed`}
              />

              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
                <button
                  onClick={() => setInputValue('')}
                  className="p-2 rounded-md transition-colors cursor-pointer text-(--muted) hover:bg-(--ink)/6 hover:text-(--red)"
                  title="Clear input"
                >
                  <Eraser size={14} />
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isSending}
                  className={inputValue.trim() && !isSending ? `${t.btnPrimary} w-9! h-9! p-0! px-0!` : 'flex items-center justify-center w-9 h-9 rounded-lg bg-(--ink)/10 text-(--muted) cursor-not-allowed'}
                  title="Send"
                >
                  {isSending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>

            <div className={`mt-2.5 flex items-center justify-between text-[10px] ${t.textMuted}`}>
              <span className="flex items-center gap-1.5 truncate">
                <Check size={11} className="text-emerald-500 shrink-0" />
                <span className="truncate font-mono">Context: {activeFile ? activeFile.name : 'Workspace'}</span>
              </span>
              <span className="font-mono tabular-nums shrink-0 ml-2">{inputValue.trim().length}/4000</span>
            </div>
          </footer>
        )}
      </div>
    </aside>
  );
}
