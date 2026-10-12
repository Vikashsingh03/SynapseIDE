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
      <code className={`select-text px-1.5 py-0.5 rounded-md font-mono text-[11px] ${
        theme === 'dark' ? 'bg-violet-500/15 text-violet-200' : 'bg-violet-50 text-violet-700'
      }`}>
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
    <div className={`my-3 overflow-hidden rounded-xl border ${
      theme === 'dark' ? 'border-white/10 bg-[#0a0a15]' : 'border-slate-200 bg-slate-50'
    }`}>
      <div className={`flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] border-b ${
        theme === 'dark' ? 'border-white/[0.07] bg-white/3 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'
      }`}>
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 normal-case tracking-normal transition-all cursor-pointer ${
            copied
              ? 'text-emerald-400'
              : theme === 'dark' ? 'text-slate-400 hover:bg-white/10 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
          }`}
          title="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span className="text-[11px] font-medium">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 custom-scrollbar select-text">
        <code className={`font-mono text-[11.5px] leading-6 select-text ${
          theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
        }`}>
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

export default function NeuraPanel({ theme }) {
  const { files, activeFile } = useFiles();
  const t = getThemeClasses(theme);
  const panelRef = useRef(null);
  const resizeStateRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
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
    if (!isOpen || hasLoadedRef.current) return;

    hasLoadedRef.current = true;
    loadConversationList();
  }, [isOpen]);

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
  if (!isOpen) {
    return (
      <div className={`w-13 rounded-2xl border flex flex-col items-center py-3 shrink-0 shadow-xl ${theme === 'dark' ? 'syn-glass shadow-black/40' : 'bg-white/85 border-slate-200 shadow-slate-300/40 backdrop-blur-xl'}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 via-indigo-500 to-cyan-500 shadow-[0_0_18px_rgba(139,92,246,0.55)] hover:shadow-[0_0_28px_rgba(139,92,246,0.8)] hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
          title="Open Neura AI Assistant"
        >
          <Sparkles className="w-4.5 h-4.5 text-white" />
          <span className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
        </button>
        <span className={`mt-2 text-[8px] font-bold uppercase tracking-[0.14em] ${t.textMuted} [writing-mode:vertical-rl]`}>
          Neura
        </span>
      </div>
    );
  }

  return (
    <aside
      ref={panelRef}
      style={{ width: `${panelWidth}px` }}
      className={`relative flex flex-col transition-[width] duration-200 shrink-0 rounded-2xl overflow-hidden shadow-2xl min-w-0 border animate-fade-in ${
        theme === 'dark' ? 'syn-glass-strong shadow-black/50' : 'bg-white/90 border-slate-200 shadow-slate-300/40 backdrop-blur-xl'
      }`}
    >
      <button
        type="button"
        aria-label="Resize Neura panel"
        onPointerDown={startResizing}
        className="absolute left-0 top-0 z-20 h-full w-3 -translate-x-1/2 cursor-col-resize hover:bg-violet-500/20 transition-colors"
      >
        <span className="sr-only">Resize</span>
      </button>

      <div className="flex flex-col w-full h-full relative min-h-0">
        {/* Header */}
        <header className={`px-4 py-3 border-b ${t.border} flex items-center justify-between shrink-0 ${theme === 'dark' ? 'bg-white/2' : 'bg-slate-50/60'}`}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 via-indigo-500 to-cyan-500 items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)]">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.8)]" style={{ borderColor: theme === 'dark' ? '#0d0d17' : '#fff' }} />
            </span>
            <div>
              <h2 className={`text-sm font-bold font-display tracking-tight ${t.textPrimary}`}>
                Neura <span className="syn-text-gradient">AI</span>
              </h2>
              <p className={`text-[10px] ${t.textMuted} flex items-center gap-1`}>
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
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
              onClick={() => setIsOpen(false)}
              className={t.iconBtn + ' p-1.5!'}
              title="Close Panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Quick actions */}
        <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b ${t.border} overflow-x-auto scrollbar-hide shrink-0`}>
          {QUICK_ACTIONS.map(({ label, prompt, Icon, primary }) => (
            <button
              key={label}
              onClick={() => handleSend(prompt)}
              disabled={isSending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none border ${
                primary
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/30 hover:bg-violet-500/25 hover:shadow-[0_4px_16px_-4px_rgba(139,92,246,0.6)]'
                  : theme === 'dark'
                    ? 'bg-white/4 text-slate-300 border-white/10 hover:bg-white/8 hover:border-white/20'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Chat / History tabs */}
        <div className={`flex px-4 gap-5 text-[10px] font-bold uppercase tracking-[0.16em] border-b ${t.border} shrink-0 ${t.textMuted}`}>
          {['chat', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-2.5 transition-colors cursor-pointer ${activeTab === tab ? 'text-violet-400' : 'hover:text-slate-300'}`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-linear-to-r from-violet-500 to-cyan-400" />
              )}
            </button>
          ))}
        </div>

        {/* Messages */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar min-w-0 min-h-0">
          {activeTab === 'chat' ? (
            <>
              {isLoadingConversation ? (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[11px] mx-auto mt-4 animate-fade-in ${t.card}`}>
                  <LoaderCircle size={13} className="animate-spin text-violet-400" />
                  <span className={t.textMuted}>Loading conversation…</span>
                </div>
              ) : messages.map((msg) => {
                const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const isUser = msg.role === 'user';
                return (
                  <div key={msg._id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-up w-full`}>
                    <div className={`flex items-center gap-1.5 mb-1.5 px-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${t.textMuted}`}>
                      {!isUser && <Sparkles size={9} className="text-violet-400" />}
                      <span>{isUser ? 'You' : 'Neura AI'}</span>
                      {timeStr && <span className="normal-case font-medium opacity-70">{timeStr}</span>}
                    </div>

                    <div className={`max-w-[92%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-md wrap-break-word overflow-hidden transition-all duration-200 ${
                      isUser
                        ? 'bg-linear-to-br from-violet-600 to-indigo-600 text-white rounded-br-md shadow-[0_8px_24px_-8px_rgba(139,92,246,0.6)]'
                        : theme === 'dark'
                          ? 'syn-glass text-slate-200 rounded-bl-md'
                          : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'
                    }`}>
                      {isUser ? (
                        <div className="whitespace-pre-wrap select-text">{msg.content}</div>
                      ) : (
                        <AssistantMessage content={msg.content} theme={theme} />
                      )}

                      {msg.role === 'assistant' && msg._id === 'welcome' && (activeFile || files.length > 0) && (
                        <div className={`mt-3 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] flex items-center justify-between gap-2 ${
                          theme === 'dark' ? 'bg-black/30 border-violet-500/20 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-600'
                        }`}>
                          <span className="truncate">Context: {activeFile ? activeFile.name : 'Workspace'}</span>
                          <Terminal size={11} className="shrink-0 opacity-60" />
                        </div>
                      )}
                    </div>

                    {msg.role === 'assistant' && msg._id !== 'welcome' && (
                      <button
                        onClick={() => copyText(msg.content)}
                        className={`mt-1.5 ml-1 p-1.5 rounded-lg opacity-0 hover:opacity-100 focus:opacity-100 transition-all cursor-pointer ${t.textMuted} hover:text-violet-300 ${theme === 'dark' ? 'hover:bg-white/6' : 'hover:bg-slate-100'}`}
                        title="Copy response"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex flex-col items-start animate-fade-up w-full">
                  <div className={`flex items-center gap-1.5 mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] ${t.textMuted}`}>
                    <Sparkles size={9} className="text-violet-400" />
                    <span>Neura AI</span>
                  </div>
                  <div className={`px-5 py-4 rounded-2xl rounded-bl-md border ${theme === 'dark' ? 'syn-glass' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <span className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-typing" />
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-typing" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-typing" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-[11px] rounded-xl border px-3.5 py-2.5 border-rose-500/30 text-rose-300 bg-rose-500/10 animate-fade-in">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} className="h-2 w-full" />
            </>
          ) : (
            <div className="space-y-1.5">
              {isLoadingHistory ? (
                <div className={`flex items-center justify-center gap-2 py-8 text-[11px] ${t.textMuted}`}>
                  <LoaderCircle size={14} className="animate-spin text-violet-400" />
                  <span>Loading chats…</span>
                </div>
              ) : conversations.length > 0 ? (
                conversations.map((item, i) => {
                  const isActive = item._id === activeConversationId;
                  return (
                    <div key={item._id} className="relative group/item animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <button
                        onClick={() => handleLoadConversation(item._id)}
                        className={`w-full flex items-center justify-between pl-3 pr-10 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                          isActive
                            ? 'bg-violet-500/12 border-violet-500/30 shadow-[0_4px_16px_-6px_rgba(139,92,246,0.5)]'
                            : theme === 'dark'
                              ? 'hover:bg-white/5 border-transparent hover:border-white/10'
                              : 'hover:bg-slate-100 border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <History size={13} className={isActive ? 'text-violet-400 shrink-0' : `${t.textMuted} shrink-0`} />
                          <span className={`text-[13px] truncate ${isActive ? 'text-violet-200 font-semibold' : t.textSecondary}`}>
                            {item.title}
                          </span>
                        </span>
                        <span className={`text-[10px] font-mono ${t.textMuted} whitespace-nowrap shrink-0 ml-2 group-hover/item:hidden`}>
                          {formatConversationTime(item.updatedAt)}
                        </span>
                      </button>

                      <button
                        onClick={(e) => deleteHistoryItem(e, item._id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover/item:opacity-100 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 rounded-lg transition-all cursor-pointer z-10"
                        title="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className={`flex flex-col items-center justify-center py-12 gap-2 opacity-60 animate-fade-in ${t.textMuted}`}>
                  <History size={30} />
                  <p className="text-xs">No chat history yet</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer input */}
        {activeTab === 'chat' && (
          <footer className={`p-3.5 border-t ${t.border} shrink-0 ${theme === 'dark' ? 'bg-white/2' : 'bg-slate-50/70'}`}>
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
                className={`${t.input} w-full min-h-22 p-3 pr-12 text-[13px] resize-none syn-focus-ring leading-relaxed`}
              />

              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
                <button
                  onClick={() => setInputValue('')}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${t.textMuted} ${theme === 'dark' ? 'hover:bg-white/[0.07] hover:text-rose-300' : 'hover:bg-slate-200 hover:text-rose-500'}`}
                  title="Clear input"
                >
                  <Eraser size={14} />
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isSending}
                  className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
                    inputValue.trim() && !isSending
                      ? 'bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-[0_6px_20px_-4px_rgba(139,92,246,0.7)] hover:shadow-[0_8px_28px_-4px_rgba(139,92,246,0.9)] hover:scale-105 active:scale-95 cursor-pointer'
                      : theme === 'dark' ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title="Send"
                >
                  {isSending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>

            <div className={`mt-2.5 flex items-center justify-between text-[10px] ${t.textMuted}`}>
              <span className="flex items-center gap-1.5 truncate">
                <Check size={11} className="text-emerald-400 shrink-0" />
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
