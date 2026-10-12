import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, Copy, Check, Pin, Reply, Pencil, Trash2,
  Search, X, CornerDownRight, SmilePlus
} from 'lucide-react';
import { copyText } from '../utils/clipboard';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';

// ─── URL / Link detection ────────────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function LinkifyText({ text }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── @Mention highlighting ───────────────────────────────────────────────────
function RichText({ text }) {
  // Split by @mentions
  const mentionRegex = /(@\w+)/g;
  const segments = text.split(mentionRegex);
  return (
    <>
      {segments.map((seg, i) =>
        seg.startsWith('@') ? (
          <span key={i} className="bg-violet-500/20 text-violet-300 font-semibold rounded px-1">
            {seg}
          </span>
        ) : (
          <LinkifyText key={i} text={seg} />
        )
      )}
    </>
  );
}

// ─── Code snippet with copy ──────────────────────────────────────────────────
function CodeSnippet({ code, theme }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const didCopy = await copyText(code);
    setCopied(didCopy);
    if (didCopy) {
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="relative group mt-1.5 rounded-xl overflow-hidden border border-white/10 animate-fade-in">
      <div className="absolute right-1.5 top-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            copied ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className={`p-3 text-[12px] font-mono overflow-x-auto custom-scrollbar ${
        theme === 'dark' ? 'bg-[#0a0a15] text-slate-300' : 'bg-slate-100 text-slate-800'
      }`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Message content parser ──────────────────────────────────────────────────
function MessageContent({ text, theme }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          const nlIdx = inner.indexOf('\n');
          const code = nlIdx >= 0 ? inner.slice(nlIdx + 1) : inner;
          return <CodeSnippet key={i} code={code} theme={theme} />;
        }
        if (!part.trim()) return null;
        return (
          <span key={i} className="whitespace-pre-wrap">
            <RichText text={part} />
          </span>
        );
      })}
    </div>
  );
}

// ─── Emoji picker (compact) ──────────────────────────────────────────────────
const QUICK_EMOJIS = ['👍', '🔥', '✅', '❤️', '😂', '👀', '🎉', '🚀'];

function EmojiPicker({ onSelect, theme }) {
  return (
    <div className={`flex gap-0.5 p-1.5 rounded-xl shadow-2xl border animate-scale-in ${
      theme === 'dark' ? 'syn-glass-strong' : 'bg-white border-slate-200'
    }`}>
      {QUICK_EMOJIS.map(e => (
        <button key={e} onClick={() => onSelect(e)}
          className="w-8 h-8 flex items-center justify-center hover:bg-violet-500/15 rounded-lg text-base cursor-pointer transition-all hover:scale-125 active:scale-95">
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Mention autocomplete dropdown ───────────────────────────────────────────
function MentionDropdown({ users, filter, onSelect, theme }) {
  const filtered = users.filter(u =>
    u.username?.toLowerCase().startsWith(filter.toLowerCase())
  );
  if (filtered.length === 0) return null;
  return (
    <div className={`absolute bottom-full left-0 mb-1.5 w-52 rounded-xl shadow-2xl border overflow-hidden z-20 animate-scale-in ${
      theme === 'dark' ? 'syn-glass-strong' : 'bg-white border-slate-200'
    }`}>
      {filtered.slice(0, 5).map(u => (
        <button key={u.userId || u.username} onClick={() => onSelect(u.username)}
          className={`w-full text-left px-3.5 py-2 text-xs font-medium cursor-pointer transition-colors ${
            theme === 'dark' ? 'hover:bg-violet-500/15 text-slate-200 hover:text-violet-200' : 'hover:bg-violet-50 text-slate-700'
          }`}>
          <span className="text-violet-400">@</span>{u.username}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CHAT PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export default function ChatPanel({
  theme, themeClasses: t, chatMessages = [], typingUsers = [],
  getSocket, roomId, currentUser, collaborators = []
}) {
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState(null);      // message being replied to
  const [editingMsg, setEditingMsg] = useState(null); // message being edited
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState(null); // messageId
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [mentionFilter, setMentionFilter] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!searchMode && !showPinned) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, typingUsers, searchMode, showPinned]);

  // Listen for search results from socket via custom event
  useEffect(() => {
    const handler = (e) => setSearchResults(e.detail || []);
    window.addEventListener('chat-search-results', handler);
    return () => window.removeEventListener('chat-search-results', handler);
  }, []);

  // Lazy load older messages on scroll to top
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    const socket = getSocket?.();
    if (!el || !socket) return;
    if (el.scrollTop === 0 && chatMessages.length > 0) {
      const oldest = chatMessages[0];
      if (oldest?.timestamp) {
        socket.emit('request-chat-history', {
          roomId,
          limit: 50,
          beforeTimestamp: oldest.timestamp
        });
      }
    }
  };

  // ─── Input handling ──────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    const socket = getSocket?.();

    // Detect @ for mention autocomplete
    const words = val.split(/\s/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      setMentionFilter(lastWord.slice(1));
    } else {
      setMentionFilter(null);
    }

    if (socket) {
      socket.emit('typing-indicator', { roomId, isTyping: true });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing-indicator', { roomId, isTyping: false });
      }, 2000);
    }
  };

  const handleMentionSelect = (username) => {
    const words = inputValue.split(/\s/);
    words[words.length - 1] = `@${username} `;
    setInputValue(words.join(' '));
    setMentionFilter(null);
    inputRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const socket = getSocket?.();
    if (!inputValue.trim() || !socket) return;

    if (editingMsg) {
      socket.emit('edit-chat-message', { messageId: editingMsg._id, content: inputValue });
      setEditingMsg(null);
    } else {
      const payload = { roomId, content: inputValue, type: 'user' };
      if (replyTo) {
        payload.replyTo = {
          messageId: replyTo._id,
          senderName: replyTo.senderName,
          content: replyTo.content?.slice(0, 80)
        };
      }
      socket.emit('send-chat-message', payload);
      setReplyTo(null);
    }

    socket.emit('typing-indicator', { roomId, isTyping: false });
    clearTimeout(typingTimeoutRef.current);
    setInputValue('');
  };

  const handleSearchSubmit = () => {
    const socket = getSocket?.();
    if (!searchQuery.trim() || !socket) return;
    socket.emit('search-chat-messages', { roomId, query: searchQuery });
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const border = t?.border || 'border-slate-700';
  const textMuted = t?.textMuted || 'text-slate-500';

  // De-duplicate messages
  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    return chatMessages.filter(m => {
      const k = m._id || `${m.timestamp}-${m.content}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [chatMessages]);

  const pinnedMessages = useMemo(() =>
    uniqueMessages.filter(m => m.pinned && !m.deleted),
    [uniqueMessages]
  );

  const displayMessages = searchMode ? searchResults : uniqueMessages;

  // ─── Render a single message ─────────────────────────────────────────────
  const renderMessage = (msg, index) => {
    const isMe = msg.senderId === currentUser?.userId;
    const isSystem = msg.type === 'system';
    const msgKey = msg._id || `msg-${index}`;
    const isDeleted = msg.deleted;
    const isHovered = hoveredMsg === msgKey;

    if (isSystem) {
      return (
        <div key={msgKey} className="flex justify-center my-2.5 animate-fade-in">
          <span className={`text-[10px] font-medium px-3 py-1 rounded-full border ${
            theme === 'dark' ? 'bg-white/4 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}>
            {msg.content}
          </span>
        </div>
      );
    }

    // Parse reactions map
    const reactions = msg.reactions
      ? (msg.reactions instanceof Map ? Object.fromEntries(msg.reactions) : msg.reactions)
      : {};
    const avatarStyle = getAvatarStyle(
      {
        userId: msg.senderId,
        name: msg.senderName,
      },
      isMe ? currentUser?.cursorColor : undefined
    );

    return (
      <div key={msgKey}
        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg animate-fade-up`}
        onMouseEnter={() => setHoveredMsg(msgKey)}
        onMouseLeave={() => { setHoveredMsg(null); setActiveEmojiPicker(null); }}
      >
        {/* Reply reference */}
        {msg.replyTo?.content && (
          <div className={`flex items-center gap-1 text-[9px] mb-1 px-2 ${textMuted} opacity-80`}>
            <CornerDownRight size={10} className="text-violet-400" />
            <span className="font-bold">{msg.replyTo.senderName}:</span>
            <span className="truncate max-w-35">{msg.replyTo.content}</span>
          </div>
        )}

        <div className={`flex items-end gap-2 max-w-[95%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          <div
            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold ring-2 ring-white/10"
            style={avatarStyle}
          >
            {getUserInitial(msg.senderName)}
          </div>

          {/* Bubble */}
          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative min-w-0`}>
            <span className={`text-[9px] font-semibold mb-1 px-1 opacity-70 ${textMuted}`}>
              {isMe ? 'You' : msg.senderName}
              {msg.edited && <span className="italic ml-1 font-normal">(edited)</span>}
              {msg.pinned && <span className="ml-1">📌</span>}
              {' · '}
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed wrap-break-word relative transition-shadow duration-200 hover:shadow-lg ${
              isDeleted
                ? 'italic opacity-60 ' + (theme === 'dark' ? 'bg-white/4 text-slate-400' : 'bg-slate-100 text-slate-500')
                : isMe
                  ? 'bg-linear-to-br from-violet-600 to-indigo-600 text-white rounded-br-md shadow-[0_6px_18px_-6px_rgba(139,92,246,0.55)]'
                  : theme === 'dark'
                    ? 'bg-white/5 text-slate-200 border border-white/8 rounded-bl-md'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm'
            }`}>
              {isDeleted ? (
                <span className="italic">This message was deleted.</span>
              ) : (
                <MessageContent text={msg.content || ''} theme={theme} />
              )}
            </div>

            {/* Action buttons (on hover) */}
            {isHovered && !isDeleted && !searchMode && (
              <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} flex gap-0.5 rounded-xl p-1 shadow-2xl border z-20 animate-scale-in ${
                theme === 'dark' ? 'syn-glass-strong' : 'bg-white border-slate-200'
              }`}>
                <button onClick={() => setActiveEmojiPicker(activeEmojiPicker === msgKey ? null : msgKey)}
                  className="p-1.5 rounded-lg hover:bg-violet-500/15 cursor-pointer transition-colors" title="React">
                  <SmilePlus size={12} className="text-slate-400" />
                </button>
                <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                  className="p-1.5 rounded-lg hover:bg-violet-500/15 cursor-pointer transition-colors" title="Reply">
                  <Reply size={12} className="text-slate-400" />
                </button>
                <button onClick={() => getSocket?.()?.emit('pin-chat-message', { messageId: msg._id })}
                  className="p-1.5 rounded-lg hover:bg-violet-500/15 cursor-pointer transition-colors" title={msg.pinned ? 'Unpin' : 'Pin'}>
                  <Pin size={12} className={msg.pinned ? 'text-amber-400' : 'text-slate-400'} />
                </button>
                {isMe && (
                  <>
                    <button onClick={() => { setEditingMsg(msg); setInputValue(msg.content); inputRef.current?.focus(); }}
                      className="p-1.5 rounded-lg hover:bg-violet-500/15 cursor-pointer transition-colors" title="Edit">
                      <Pencil size={12} className="text-slate-400" />
                    </button>
                    <button onClick={() => getSocket?.()?.emit('delete-chat-message', { messageId: msg._id })}
                      className="p-1.5 rounded-lg hover:bg-rose-500/15 cursor-pointer transition-colors" title="Delete">
                      <Trash2 size={12} className="text-rose-400" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Emoji picker popover */}
            {activeEmojiPicker === msgKey && (
              <div className={`absolute -top-14 ${isMe ? 'right-0' : 'left-0'} z-30`}>
                <EmojiPicker theme={theme} onSelect={(emoji) => {
                  getSocket?.()?.emit('react-chat-message', { messageId: msg._id, emoji });
                  setActiveEmojiPicker(null);
                }} />
              </div>
            )}

            {/* Reactions display */}
            {Object.keys(reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {Object.entries(reactions).map(([emoji, users]) => {
                  const reactionUsers = Array.isArray(users) ? users : [];
                  if (reactionUsers.length === 0) return null;
                  const iReacted = reactionUsers.some(u => u.userId === currentUser?.userId);
                  return (
                    <button key={emoji}
                      onClick={() => getSocket?.()?.emit('react-chat-message', { messageId: msg._id, emoji })}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                        iReacted
                          ? 'border-violet-500/60 bg-violet-500/15 shadow-[0_0_10px_-2px_rgba(139,92,246,0.5)]'
                          : theme === 'dark' ? 'border-white/10 bg-white/5 hover:bg-white/9' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                      title={reactionUsers.map(u => u.username).join(', ')}
                    >
                      <span>{emoji}</span>
                      <span className={`${textMuted} font-semibold`}>{reactionUsers.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-transparent min-h-0">

      {/* ─── Header bar with search + pinned ──────────────────────────────── */}
      <div className={`flex items-center gap-1 px-3 py-2 border-b ${border} shrink-0`}>
        {searchMode ? (
          <div className="flex items-center gap-1.5 flex-1 animate-fade-in">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Search messages…"
              className={`${t.input} flex-1 text-xs px-2.5 py-1.5 syn-focus-ring`}
              autoFocus
            />
            <button onClick={handleSearchSubmit} className={`${t.iconBtn} p-1.5!`} title="Search">
              <Search size={13} />
            </button>
            <button onClick={() => { setSearchMode(false); setSearchQuery(''); setSearchResults([]); }}
              className={`${t.iconBtn} p-1.5!`} title="Close search">
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => setSearchMode(true)}
              className={`${t.iconBtn} p-1.5!`} title="Search messages">
              <Search size={13} />
            </button>
            {pinnedMessages.length > 0 && (
              <button onClick={() => setShowPinned(!showPinned)}
                className={`p-1.5 rounded-lg cursor-pointer flex items-center gap-1 text-[10px] font-bold transition-all ${
                  showPinned ? 'text-amber-300 bg-amber-500/15' : 'text-slate-400 hover:bg-white/6'
                }`}
                title="Pinned messages">
                <Pin size={12} />
                <span>{pinnedMessages.length}</span>
              </button>
            )}
            <div className="flex-1" />
            <span className={`text-[10px] font-mono ${textMuted}`}>
              {uniqueMessages.filter(m => m.type !== 'system').length} msgs
            </span>
          </>
        )}
      </div>

      {/* ─── Pinned messages bar ──────────────────────────────────────────── */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className={`px-3 py-2.5 border-b ${border} space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar animate-fade-in ${theme === 'dark' ? 'bg-amber-500/4' : 'bg-amber-50/60'}`}>
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-[0.12em] mb-1">
            <Pin size={10} /> Pinned
          </div>
          {pinnedMessages.map(pm => (
            <div key={pm._id} className={`text-[10px] px-2.5 py-1.5 rounded-lg leading-relaxed ${
              theme === 'dark' ? 'bg-white/4 text-slate-300 border border-white/6' : 'bg-white text-slate-700 border border-amber-200'
            }`}>
              <span className="font-bold text-amber-400">{pm.senderName}:</span> {pm.content?.slice(0, 100)}
            </div>
          ))}
        </div>
      )}

      {/* ─── Messages list ────────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-3.5 py-3 space-y-3.5 min-h-0"
      >
        {searchMode && searchResults.length === 0 && searchQuery && (
          <div className={`text-xs ${textMuted} text-center py-10 opacity-70 animate-fade-in`}>
            No results for <span className="font-mono text-violet-400">"{searchQuery}"</span>
          </div>
        )}

        {!searchMode && uniqueMessages.length === 0 && (
          <div className={`flex flex-col items-center gap-2 text-xs ${textMuted} text-center py-10 opacity-70 animate-fade-in`}>
            <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
              <Send size={16} className="text-violet-400" />
            </span>
            <span>No messages yet.<br />Say hello to the room!</span>
          </div>
        )}

        {displayMessages.map((msg, i) => renderMessage(msg, i))}

        {/* Typing Indicators */}
        {!searchMode && typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1 opacity-80 animate-fade-in">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-typing" />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-typing" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-typing" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="font-medium">{typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Reply / Edit banner ──────────────────────────────────────────── */}
      {(replyTo || editingMsg) && (
        <div className={`mx-3 mb-2 px-3 py-2 rounded-xl border flex items-center gap-2 text-[10px] ${textMuted} animate-fade-in ${
          theme === 'dark' ? 'bg-violet-500/8 border-violet-500/25' : 'bg-violet-50 border-violet-200'
        }`}>
          {replyTo && (
            <>
              <Reply size={11} className="text-violet-400 shrink-0" />
              <span className="truncate">Replying to <span className="font-bold text-violet-300">{replyTo.senderName}</span>: {replyTo.content?.slice(0, 60)}</span>
            </>
          )}
          {editingMsg && (
            <>
              <Pencil size={11} className="text-amber-400 shrink-0" />
              <span className="font-medium">Editing message…</span>
            </>
          )}
          <button onClick={() => { setReplyTo(null); setEditingMsg(null); setInputValue(''); }}
            className="ml-auto p-1 hover:bg-white/10 rounded-lg cursor-pointer shrink-0 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ─── Input Area ───────────────────────────────────────────────────── */}
      <div className={`p-3 border-t ${border} shrink-0 ${theme === 'dark' ? 'bg-white/2' : 'bg-slate-50/60'}`}>
        <form onSubmit={handleSubmit} className="relative">
          {/* Mention dropdown */}
          {mentionFilter && (
            <MentionDropdown
              users={collaborators}
              filter={mentionFilter}
              onSelect={handleMentionSelect}
              theme={theme}
            />
          )}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
              if (e.key === 'Escape') {
                setReplyTo(null);
                setEditingMsg(null);
                setInputValue('');
              }
            }}
            placeholder={
              editingMsg ? 'Edit your message…'
                : replyTo ? `Reply to ${replyTo.senderName}…`
                  : 'Message the room… (@ to mention)'
            }
            className={`${t.input} w-full resize-none p-2.5 pr-11 text-xs syn-focus-ring leading-relaxed custom-scrollbar`}
            rows="2"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className={`absolute right-1.5 bottom-2 p-2 rounded-xl transition-all duration-200 ${
              inputValue.trim()
                ? 'bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-[0_4px_16px_-2px_rgba(139,92,246,0.7)] hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-transparent text-slate-500 cursor-not-allowed'
            }`}
            title="Send"
          >
            <Send size={13} />
          </button>
        </form>
        <div className={`text-[9px] mt-1.5 px-1 ${textMuted} font-mono opacity-80`}>
          ``` code · @mention · Shift+Enter newline
        </div>
      </div>
    </div>
  );
}
