import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  Plus,
  Users,
  Code2,
  LogOut,
  Clock,
  Search,
  Trash2,
  FileCode2,
  FolderOpen,
  ArrowRight,
  X,
  Terminal,
  ChevronRight,
  Waypoints,
} from 'lucide-react';
import { getRecentRooms, getSharedRooms, deleteRoom } from '../services/roomService';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';
import { getThemeClasses } from '../utils/theme';
import { readStorage } from '../utils/storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_GAP_MS = 45 * 60 * 60 * 1000;
const SESSION_MIN_MS = 15 * 60 * 1000;
const SESSION_MAX_MS = 2 * 60 * 60 * 1000;

function countLines(content = '') {
  return String(content)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .length;
}

function formatCompactCount(value) {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatHours(minutes) {
  if (minutes < 60) {
    return `${Math.max(0, Math.round(minutes))} min this week`;
  }

  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} ${hours === 1 ? 'hr' : 'hrs'} this week`;
}

function gatherRoomActivityTimestamps(room) {
  const timestamps = [];

  if (Array.isArray(room?.versions)) {
    room.versions.forEach((version) => {
      const timestamp = new Date(version?.timestamp).getTime();
      if (Number.isFinite(timestamp)) {
        timestamps.push(timestamp);
      }
    });
  }

  if (Array.isArray(room?.files)) {
    room.files.forEach((file) => {
      const timestamp = new Date(file?.updatedAt || room?.lastUpdated || room?.createdAt).getTime();
      if (Number.isFinite(timestamp)) {
        timestamps.push(timestamp);
      }
    });
  }

  const roomCreatedAt = new Date(room?.createdAt).getTime();
  if (Number.isFinite(roomCreatedAt)) {
    timestamps.push(roomCreatedAt);
  }

  return Array.from(new Set(timestamps)).sort((left, right) => left - right);
}

function estimateCodingMinutes(room, windowStart, windowEnd) {
  const timestamps = gatherRoomActivityTimestamps(room).filter(
    (timestamp) => timestamp >= windowStart && timestamp < windowEnd
  );

  if (timestamps.length === 0) {
    return 0;
  }

  let totalMinutes = 0;
  let sessionStart = timestamps[0];
  let previousTimestamp = timestamps[0];

  for (let index = 1; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];

    if (timestamp - previousTimestamp > SESSION_GAP_MS) {
      const sessionDuration = Math.min(
        Math.max(previousTimestamp - sessionStart + SESSION_MIN_MS, SESSION_MIN_MS),
        SESSION_MAX_MS
      );
      totalMinutes += sessionDuration / 60000;
      sessionStart = timestamp;
    }

    previousTimestamp = timestamp;
  }

  const finalSessionDuration = Math.min(
    Math.max(previousTimestamp - sessionStart + SESSION_MIN_MS, SESSION_MIN_MS),
    SESSION_MAX_MS
  );
  totalMinutes += finalSessionDuration / 60000;

  return totalMinutes;
}

function calculateTimeSpentStats(rooms, currentTime) {
  const currentWindowStart = currentTime - WEEK_MS;
  const previousWindowStart = currentTime - WEEK_MS * 2;

  const currentMinutes = rooms.reduce(
    (total, room) => total + estimateCodingMinutes(room, currentWindowStart, currentTime),
    0
  );
  const previousMinutes = rooms.reduce(
    (total, room) => total + estimateCodingMinutes(room, previousWindowStart, currentWindowStart),
    0
  );

  const changePercent = previousMinutes > 0
    ? Math.round(((currentMinutes - previousMinutes) / previousMinutes) * 100)
    : currentMinutes > 0
      ? 100
      : 0;

  return {
    value: formatHours(currentMinutes),
    meta: `${changePercent >= 0 ? '+' : ''}${changePercent}% vs last week`,
    metaPositive: changePercent >= 0,
  };
}

const ACTIONS = [
  {
    to: '/editor',
    title: 'Open Editor',
    desc: 'Launch the full-featured code editor with multi-language support.',
    icon: Terminal,
  },
  {
    to: '/create-room',
    title: 'Create Room',
    desc: 'Start a new collaborative coding session for your team.',
    icon: Plus,
  },
  {
    to: '/join-room',
    title: 'Join Room',
    desc: 'Enter an existing room using a shared invite code.',
    icon: Users,
  },
];

function ActionCard({ action, index, t }) {
  const { to, title, desc, icon: Icon } = action;

  return (
    <Link
      to={to}
      className={`${t.card} ${t.cardHover} group p-5 flex items-start gap-4 animate-fade-up transition-colors`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className={`w-10 h-10 rounded-lg border ${t.border} flex items-center justify-center shrink-0 bg-(--paper-2)`}>
        <Icon size={18} className={t.textSecondary} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-[15px] font-extrabold tracking-tight ${t.textPrimary}`}>{title}</h3>
          <ArrowRight
            size={16}
            className={`${t.textMuted2} shrink-0 group-hover:translate-x-0.5 transition-transform duration-150`}
          />
        </div>
        <p className={`text-[13px] ${t.textSecondary} leading-relaxed mt-1`}>{desc}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentRooms, setRecentRooms] = useState([]);
  const [sharedRooms, setSharedRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [theme] = useState(() => readStorage('synapse-theme') || 'dark');
  const t = getThemeClasses(theme);
  const dark = theme === 'dark';

  const displayName = user?.name || user?.email?.split('@')[0] || 'Developer';
  const avatarInitial = getUserInitial(user);
  const avatarStyle = getAvatarStyle(user);

  useEffect(() => {
    document.body.style.backgroundColor = dark ? '#111310' : '#f3f1eb';
    return () => { document.body.style.backgroundColor = ''; };
  }, [dark]);

  useEffect(() => {
    if (user?.userId) {
      setLoadingRooms(true);
      Promise.all([getRecentRooms(user.userId), getSharedRooms(user.userId)])
        .then(([ownedRooms, joinedRooms]) => {
          setRecentRooms(ownedRooms);
          setSharedRooms(joinedRooms);
        })
        .catch(console.error)
        .finally(() => setLoadingRooms(false));
    }
  }, [user?.userId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  function handleDeleteClick(e, room) {
    e.preventDefault();
    e.stopPropagation();
    setRoomToDelete(room);
  }

  async function confirmDeleteRoom() {
    if (!roomToDelete) return;
    try {
      await deleteRoom(roomToDelete.roomId);
      setRecentRooms((prev) => prev.filter((r) => r.roomId !== roomToDelete.roomId));
      setSharedRooms((prev) => prev.filter((r) => r.roomId !== roomToDelete.roomId));
      setRoomToDelete(null);
    } catch (err) {
      console.error('Failed to delete room:', err);
      alert(err.message || 'Failed to delete room.');
    }
  }

  /* ---------- helpers ---------- */
  function timeAgo(dateStr, currentTime) {
    const diff = currentTime - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  }

  const visibleRooms = activeTab === 'shared' ? sharedRooms : recentRooms;

  const filteredRooms = visibleRooms.filter((room) => {
    const q = searchQuery.toLowerCase();
    return (
      (room.roomName || '').toLowerCase().includes(q) ||
      (room.roomId || '').toLowerCase().includes(q)
    );
  });

  const joinedRoomCount = new Set(
    [...recentRooms, ...sharedRooms].map((room) => room.roomId)
  ).size;

  /* ---------- stats ---------- */
  const stats = useMemo(() => {
    const totalLinesContributed = recentRooms.reduce((total, room) => {
      const roomLineCount = Array.isArray(room.files)
        ? room.files.reduce((fileTotal, file) => fileTotal + countLines(file?.content || ''), 0)
        : 0;

      return total + roomLineCount;
    }, 0);

    const timeSpentStats = calculateTimeSpentStats(recentRooms, now);

    return [
      {
        label: 'Rooms Joined',
        value: String(joinedRoomCount),
        icon: Clock,
      },
      {
        label: 'Lines Contributed',
        value: formatCompactCount(totalLinesContributed),
        meta: 'across shared rooms',
        icon: FileCode2,
      },
      {
        label: 'Time Coding',
        value: timeSpentStats.value,
        meta: timeSpentStats.meta,
        metaPositive: timeSpentStats.metaPositive,
        icon: Code2,
      },
    ];
  }, [now, recentRooms, joinedRoomCount]);

  const tabs = [
    { id: 'recent', label: 'Recently Edited' },
    { id: 'shared', label: 'Shared with Me' },
  ];

  return (
    <div className={`min-h-screen syn-grain ${t.page}`} data-theme={theme}>
      {/* ─── Header ─── */}
      <header className={t.header}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-(--red) flex items-center justify-center shadow-[2px_2px_0_var(--ink)]">
              <Waypoints size={16} className="text-white" />
            </span>
            <span className={`text-[16px] font-extrabold tracking-tight ${t.textPrimary}`}>Synapse</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden md:block w-52">
              <div className={`flex items-center gap-2 rounded-lg border h-9 px-3 ${t.border} bg-(--panel)`}>
                <Search size={14} className={`${t.textMuted2} shrink-0`} />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`bg-transparent outline-none text-sm w-full ${t.textPrimary} placeholder:text-(--muted)`}
                />
              </div>
            </div>

            <div className="h-5 w-px bg-(--line) hidden sm:block" />

            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-[11px] font-semibold text-white"
                style={avatarStyle}
              >
                {avatarInitial}
              </span>
              <span className={`text-sm font-bold ${t.textSecondary} hidden sm:block max-w-32 truncate`}>{displayName}</span>
            </div>

            <button
              onClick={logout}
              title="Log out"
              className={t.iconBtn}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="max-w-6xl mx-auto px-6 pt-12 pb-20">
        {/* Hero */}
        <div className="mb-10 animate-fade-up">
          <p className={`${t.eyebrow} inline-flex items-center gap-2 mb-5`}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Work session active
          </p>
          <h1 className={`text-4xl md:text-[3.4rem] font-extrabold tracking-[-0.04em] leading-[1.05] ${t.textPrimary} mb-3`}>
            Welcome back, {displayName}
          </h1>
          <p className={`text-[16px] ${t.textSecondary}`}>
            Ready to{' '}
            <span className="inline-block -rotate-1 bg-(--acid) px-1.5 font-extrabold text-zinc-950">
              build
            </span>{' '}
            something today?
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/create-room" className={t.btnAccent}>
              <Plus size={16} /> New Room
            </Link>
            <Link to="/editor" className={t.btnSecondary}>
              <Terminal size={15} /> Open editor
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`${t.card} ${t.cardHover} p-5 animate-fade-up transition-all duration-200 hover:-translate-y-0.5`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="w-8 h-8 rounded-lg border flex items-center justify-center"
                  style={{
                    background: i === 0 ? 'rgba(21,87,255,0.1)' : i === 1 ? 'rgba(255,77,53,0.1)' : 'rgba(217,255,63,0.12)',
                    borderColor: i === 0 ? 'rgba(21,87,255,0.25)' : i === 1 ? 'rgba(255,77,53,0.25)' : 'rgba(217,255,63,0.25)',
                    color: i === 0 ? 'var(--blue)' : i === 1 ? 'var(--red)' : dark ? 'var(--acid)' : '#5a6b00',
                  }}
                >
                  <stat.icon size={15} />
                </span>
                <span className={t.eyebrow}>{stat.label}</span>
              </div>
              <p className={`text-[28px] font-extrabold tracking-tight tabular-nums font-mono ${t.textPrimary}`}>{stat.value}</p>
              {stat.meta && (
                <p className={`text-xs mt-1.5 font-mono ${
                  stat.metaPositive === undefined
                    ? t.textMuted2
                    : stat.metaPositive
                      ? (dark ? 'text-emerald-400' : 'text-emerald-600')
                      : 'text-(--red-deep)'
                }`}>
                  {stat.meta}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {ACTIONS.map((action, i) => (
            <ActionCard key={action.to} action={action} index={i} t={t} />
          ))}
        </section>

        {/* Rooms */}
        <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
            <div className="flex items-center gap-6">
              <h2 className={`text-xl font-extrabold tracking-tight ${t.textPrimary}`}>Rooms</h2>
              <div className="flex items-center gap-5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-1.5 font-mono text-xs font-bold uppercase tracking-[0.08em] border-b-2 transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? `border-(--blue) ${t.tabActive}`
                        : `border-transparent ${t.tabInactive}`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <span className={`font-mono text-xs ${t.textMuted2}`}>
              {filteredRooms.length} room{filteredRooms.length === 1 ? '' : 's'}
            </span>
          </div>

          {loadingRooms ? (
            <div className={`${t.card} overflow-hidden divide-y ${t.divider}`}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className={`h-4 w-44 rounded ${dark ? 'bg-white/6' : 'bg-zinc-200'}`} />
                  <div className={`h-4 w-20 rounded ml-auto ${dark ? 'bg-white/4' : 'bg-zinc-100'}`} />
                </div>
              ))}
            </div>
          ) : filteredRooms.length > 0 ? (
            <div className={`${t.card} overflow-hidden divide-y ${t.divider}`}>
              {filteredRooms.map((room) => {
                const fileCount = Array.isArray(room.files)
                  ? room.files.filter((f) => f.type === 'file').length
                  : 0;
                const canDeleteRoom = room.createdBy === user?.userId;
                return (
                  <div
                    key={room.roomId}
                    onClick={() => navigate(`/room/${room.roomId}`)}
                    className={`group flex items-center gap-4 px-5 py-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${dark ? 'hover:bg-white/3' : 'hover:bg-(--paper-2)'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <h4 className={`text-[15px] font-extrabold tracking-tight truncate ${t.textPrimary}`}>
                          {room.roomName || 'Untitled Room'}
                        </h4>
                        <span className={t.chip}>{room.roomId}</span>
                      </div>
                      <p className={`text-xs ${t.textMuted2} mt-1 flex items-center gap-3 font-mono`}>
                        <span className="inline-flex items-center gap-1">
                          <FileCode2 size={12} />
                          {fileCount} {fileCount === 1 ? 'file' : 'files'}
                        </span>
                        <span>Edited {timeAgo(room.lastUpdated, now)}</span>
                      </p>
                    </div>
                    {canDeleteRoom ? (
                      <button
                        title="Delete room"
                        onClick={(e) => handleDeleteClick(e, { roomId: room.roomId, roomName: room.roomName })}
                        className={`${t.iconBtn} shrink-0`}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                    <ChevronRight
                      size={16}
                      className={`${t.textMuted2} shrink-0 group-hover:translate-x-0.5 group-hover:text-(--blue) transition-all duration-150`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${t.card} py-14 px-8 text-center`}>
              <div className={`w-10 h-10 rounded-lg border ${t.border} flex items-center justify-center mx-auto mb-4 bg-(--paper-2)`}>
                <FolderOpen size={18} className={t.textMuted2} />
              </div>
              <p className={`text-[16px] font-extrabold tracking-tight ${t.textPrimary} mb-1`}>
                {searchQuery
                  ? 'No rooms match your search'
                  : activeTab === 'shared'
                    ? 'No shared rooms yet'
                    : 'No rooms yet'}
              </p>
              <p className={`text-sm ${t.textSecondary} mb-6`}>
                {searchQuery || activeTab === 'shared'
                  ? 'Try a different search or tab.'
                  : 'Create your first collaborative room to get started.'}
              </p>
              {!searchQuery && activeTab !== 'shared' && (
                <Link to="/create-room" className={t.btnAccent}>
                  <Plus size={16} /> Create room
                </Link>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Delete confirmation */}
      {roomToDelete && (
        <div className={t.modalOverlay} onClick={() => setRoomToDelete(null)}>
          <div
            className={`${t.modalCard} p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${dark ? 'border-(--red)/30 bg-(--red)/8' : 'border-(--red)/25 bg-(--red)/7'}`}>
                <Trash2 size={18} className="text-(--red-deep)" />
              </div>
              <button
                onClick={() => setRoomToDelete(null)}
                className={t.iconBtn}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <h3 className={`text-lg font-extrabold tracking-tight ${t.textPrimary} mb-2`}>Delete room?</h3>
            <p className={`text-sm ${t.textSecondary} leading-relaxed mb-6`}>
              <span className={`font-bold ${t.textPrimary}`}>{roomToDelete.roomName || roomToDelete.roomId}</span>
              {' '}will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRoomToDelete(null)}
                className={t.btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRoom}
                className={t.btnDanger}
              >
                Delete room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
