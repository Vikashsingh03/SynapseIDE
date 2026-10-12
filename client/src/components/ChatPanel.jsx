import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, Copy, Check, Pin, Reply, Pencil, Trash2,
  Search, X, CornerDownRight, MessageSquare
} from 'lucide-react';
import { copyText } from '../utils/clipboard';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';

// ─── URL / Link detection ────────────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function LinkifyText({ text, theme }) {
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
            className="text-(--blue) hover:underline break-all"
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
function RichText({ text, theme }) {
  // Split by @mentions
  const mentionRegex = /(@\w+)/g;
  const segments = text.split(mentionRegex);
  return (
    <>
      {segments.map((seg, i) =>
        seg.startsWith('@') ? (
          <span key={i} className="font-bold font-mono rounded px-1 border bg-(--blue)/10 text-(--blue) border-(--blue)/25">
            {seg}
          </span>
        ) : (
          <LinkifyText key={i} text={seg} theme={theme} />
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
    <div className="relative group mt-1.5 rounded-lg overflow-hidden border animate-fade-in border-(--line)">
      <div className="absolute right-1.5 top-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className={`p-1.5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            copied
              ? 'bg-emerald-500/15 text-emerald-600'
              : 'bg-(--ink)/5 hover:bg-(--ink)/9 text-(--muted)'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="p-3 text-[12px] font-mono overflow-x-auto custom-scrollbar bg-(--paper) text-(--ink)">
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
            <RichText text={part} theme={theme} />
          </span>
        );
      })}
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
    <div className="absolute bottom-full left-0 mb-1.5 w-52 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.35)] border overflow-hidden z-20 animate-fade-in bg-(--paper-2) border-(--line)">
      {filtered.slice(0, 5).map(u => (
        <button key={u.userId || u.username} onClick={() => onSelect(u.username)}
          className="w-full text-left px-3.5 py-2 text-xs font-medium cursor-pointer transition-colors hover:bg-(--ink)/5 text-(--ink)">
          <span className="text-(--blue)">@</span>{u.username}
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
          <span className="font-mono text-[10px] font-medium px-3 py-1 rounded-md border bg-(--ink)/4 border-(--line) text-(--muted)">
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
        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg animate-fade-in`}
        onMouseEnter={() => setHoveredMsg(msgKey)}
        onMouseLeave={() => setHoveredMsg(null)}
      >
        {/* Reply reference */}
        {msg.replyTo?.content && (
          <div className={`flex items-center gap-1 text-[9px] mb-1 px-2 ${textMuted} opacity-80`}>
            <CornerDownRight size={10} />
            <span className="font-bold">{msg.replyTo.senderName}:</span>
            <span className="truncate max-w-35">{msg.replyTo.content}</span>
          </div>
        )}

        <div className={`flex items-end gap-2 max-w-[95%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          <div
            className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold border ${theme === 'dark' ? 'border-white/10' : 'border-black/10'}`}
            style={avatarStyle}
          >
            {getUserInitial(msg.senderName)}
          </div>

          {/* Bubble */}
          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative min-w-0`}>
            <span className={`text-[9px] font-semibold mb-1 px-1 opacity-70 ${textMuted}`}>
              {isMe ? 'You' : msg.senderName}
              {msg.edited && <span className="italic ml-1 font-normal">(edited)</span>}
              {msg.pinned && <Pin size={9} className="inline ml-1 -mt-0.5" />}
              {' · '}
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            <div className={`px-3.5 py-2.5 rounded-lg text-xs leading-relaxed wrap-break-word relative border ${
              isDeleted
                ? 'italic opacity-60 bg-(--ink)/3 text-(--muted) border-(--line)'
                : isMe
                  ? 'bg-(--ink) text-(--paper) border-(--ink)'
                  : 'bg-(--paper) text-(--ink) border-(--line)'
            }`}>
              {isDeleted ? (
                <span className="italic">This message was deleted.</span>
              ) : (
                <MessageContent text={msg.content || ''} theme={theme} />
              )}
            </div>

            {/* Action buttons (on hover) */}
            {isHovered && !isDeleted && !searchMode && (
              <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} flex gap-0.5 rounded-lg p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)] border z-20 animate-fade-in bg-(--paper-2) border-(--line)`}>
                <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                  className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-(--ink)/6" title="Reply">
                  <Reply size={12} className="text-(--muted)" />
                </button>
                <button onClick={() => getSocket?.()?.emit('pin-chat-message', { messageId: msg._id })}
                  className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-(--ink)/6" title={msg.pinned ? 'Unpin' : 'Pin'}>
                  <Pin size={12} className={msg.pinned ? 'text-amber-500' : 'text-(--muted)'} />
                </button>
                {isMe && (
                  <>
                    <button onClick={() => { setEditingMsg(msg); setInputValue(msg.content); inputRef.current?.focus(); }}
                      className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-(--ink)/6" title="Edit">
                      <Pencil size={12} className="text-(--muted)" />
                    </button>
                    <button onClick={() => getSocket?.()?.emit('delete-chat-message', { messageId: msg._id })}
                      className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-(--red)/10" title="Delete">
                      <Trash2 size={12} className="text-(--red)" />
                    </button>
                  </>
                )}
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
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border cursor-pointer transition-colors ${
                        iReacted
                          ? 'border-(--blue)/40 bg-(--blue)/10'
                          : 'border-(--line) bg-(--ink)/3 hover:bg-(--ink)/6'
                      }`}
                      title={reactionUsers.map(u => u.username).join(', ')}
                    >
                      <span>{emoji}</span>
                      <span className="text-(--muted) font-semibold font-mono">{reactionUsers.length}</span>
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
              className={`${t.input} flex-1 text-xs px-2.5 py-1.5`}
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
                className={`p-1.5 rounded-md cursor-pointer flex items-center gap-1 font-mono text-[10px] font-bold transition-colors ${
                  showPinned
                    ? 'text-amber-600 bg-amber-500/10'
                    : 'text-(--muted) hover:bg-(--ink)/5'
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
        <div className={`px-3 py-2.5 border-b ${border} space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar animate-fade-in bg-amber-500/5`}>
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] mb-1 text-amber-600">
            <Pin size={10} /> Pinned
          </div>
          {pinnedMessages.map(pm => (
            <div key={pm._id} className="text-[10px] px-2.5 py-1.5 rounded-md leading-relaxed border bg-(--paper) text-(--muted) border-(--line)">
              <span className="font-bold text-amber-600">{pm.senderName}:</span> {pm.content?.slice(0, 100)}
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
          <div className={`text-xs ${textMuted} text-center py-10 animate-fade-in`}>
            No results for <span className="font-mono">"{searchQuery}"</span>
          </div>
        )}

        {!searchMode && uniqueMessages.length === 0 && (
          <div className="flex flex-col items-center gap-3 text-center py-10 animate-fade-in">
            <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
              <MessageSquare size={16} className="text-(--muted)" />
            </span>
            <p className={`text-[15px] font-extrabold ${t.textPrimary}`}>No messages yet</p>
            <p className={`text-xs font-mono ${t.textMuted}`}>Say hello to the room</p>
          </div>
        )}

        {displayMessages.map((msg, i) => renderMessage(msg, i))}

        {/* Typing Indicators */}
        {!searchMode && typingUsers.length > 0 && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-(--muted) px-1 animate-fade-in">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-(--blue) animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-(--blue) animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-(--blue) animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="font-medium">{typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Reply / Edit banner ──────────────────────────────────────────── */}
      {(replyTo || editingMsg) && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg border flex items-center gap-2 font-mono text-[10px] text-(--muted) animate-fade-in bg-(--ink)/3 border-(--line)">
          {replyTo && (
            <>
              <Reply size={11} className="shrink-0 text-(--blue)" />
              <span className="truncate">Replying to <span className="font-bold"> {replyTo.senderName}</span>: {replyTo.content?.slice(0, 60)}</span>
            </>
          )}
          {editingMsg && (
            <>
              <Pencil size={11} className="text-amber-500 shrink-0" />
              <span className="font-medium">Editing message…</span>
            </>
          )}
          <button onClick={() => { setReplyTo(null); setEditingMsg(null); setInputValue(''); }}
            className="ml-auto p-1 rounded-md cursor-pointer shrink-0 transition-colors hover:bg-(--ink)/7">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ─── Input Area ───────────────────────────────────────────────────── */}
      <div className={`p-3 border-t ${border} shrink-0`}>
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
            className={`${t.input} w-full resize-none p-2.5 pr-11 text-xs leading-relaxed custom-scrollbar`}
            rows="2"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className={inputValue.trim() ? `${t.btnPrimary} p-2! px-2! absolute right-1.5 bottom-2` : 'absolute right-1.5 bottom-2 p-2 rounded-lg bg-transparent text-(--muted) opacity-40 cursor-not-allowed'}
            title="Send"
          >
            <Send size={13} />
          </button>
        </form>
        <div className={`text-[9px] mt-1.5 px-1 ${textMuted} font-mono`}>
          ``` code · @mention · Shift+Enter newline
        </div>
      </div>
    </div>
  );
}
