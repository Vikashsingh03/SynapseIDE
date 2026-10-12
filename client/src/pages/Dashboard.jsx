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
  Monitor,
  Terminal,
  Trash2,
  FileCode2,
  FolderOpen,
  ArrowRight,
  X,
} from 'lucide-react';
import { getRecentRooms, getSharedRooms, deleteRoom } from '../services/roomService';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';
import SynapseInteractiveBackground from '../components/SynapseInteractiveBackground';
import SynapseLogo from '../components/SynapseLogo';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_GAP_MS = 45 * 60 * 1000;
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
    bgIcon: Monitor,
    variant: 'primary',
  },
  {
    to: '/create-room',
    title: 'Create Room',
    desc: 'Start a new collaborative coding session for your team.',
    icon: Plus,
    bgIcon: Plus,
    variant: 'green',
  },
  {
    to: '/join-room',
    title: 'Join Room',
    desc: 'Enter an existing room using a shared invite code.',
    icon: Users,
    bgIcon: Users,
    variant: 'purple',
  },
];

function ActionCard({ action, index }) {
  const { to, title, desc, icon: Icon, bgIcon: BgIcon, variant } = action;

  if (variant === 'primary') {
    return (
      <Link
        to={to}
        className="syn-card-hover group relative overflow-hidden rounded-2xl p-8 text-left bg-linear-to-br from-violet-600 via-indigo-600 to-indigo-700 border border-white/15 animate-fade-up"
        style={{ animationDelay: `${index * 90}ms` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
        <BgIcon size={170} className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 group-hover:text-white/[0.14] transition-all duration-500" />
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-white/12 border border-white/25 backdrop-blur-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Icon size={24} className="text-white" />
          </div>
          <h3 className="font-display text-2xl font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-indigo-100/75 leading-relaxed max-w-55">{desc}</p>
          <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-white">
            Launch
            <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </span>
        </div>
      </Link>
    );
  }

  const accent = variant === 'green'
    ? { text: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25', glow: 'group-hover:border-emerald-500/40', bgIcon: 'text-emerald-400' }
    : { text: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/25', glow: 'group-hover:border-violet-500/40', bgIcon: 'text-violet-400' };

  return (
    <Link
      to={to}
      className={`syn-card-hover syn-glass group relative overflow-hidden rounded-2xl p-8 text-left ${accent.glow} animate-fade-up`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <BgIcon size={170} className={`absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-[0.13] group-hover:scale-110 transition-all duration-500 ${accent.bgIcon}`} />
      <div className="relative">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-300 ${accent.bg}`}>
          <Icon size={24} className={accent.text} />
        </div>
        <h3 className="font-display text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed max-w-55">{desc}</p>
        <span className={`inline-flex items-center gap-1.5 mt-5 text-sm font-semibold ${accent.text}`}>
          Continue
          <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform duration-300" />
        </span>
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

  const displayName = user?.name || user?.email?.split('@')[0] || 'Developer';
  const avatarInitial = getUserInitial(user);
  const avatarStyle = getAvatarStyle(user);

  useEffect(() => {
    document.body.style.backgroundColor = '#030711';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

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
        accent: 'text-sky-400',
        chip: 'bg-sky-500/10 border-sky-500/25',
      },
      {
        label: 'Lines Contributed',
        value: formatCompactCount(totalLinesContributed),
        meta: 'across shared rooms',
        icon: FileCode2,
        accent: 'text-violet-400',
        chip: 'bg-violet-500/10 border-violet-500/25',
      },
      {
        label: 'Time Coding',
        value: timeSpentStats.value,
        meta: timeSpentStats.meta,
        metaPositive: timeSpentStats.metaPositive,
        icon: Code2,
        accent: 'text-emerald-400',
        chip: 'bg-emerald-500/10 border-emerald-500/25',
      },
    ];
  }, [now, recentRooms, joinedRoomCount]);

  return (
    <div className="min-h-screen bg-void text-slate-200 syn-noise relative">
      <SynapseInteractiveBackground />

      {/* aurora orbs */}
      <div className="pointer-events-none fixed inset-0 z-1">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-violet-600/15 blur-[130px] animate-aurora" />
        <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-[120px] animate-aurora" style={{ animationDelay: '-10s' }} />
      </div>

      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 bg-void/75 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)] group-hover:scale-105 transition-transform duration-200">
              <SynapseLogo size={18} color="#ffffff" nodeColor="#ffffff" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white uppercase">Synapse</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-full syn-input pl-3.5 pr-4 py-2 w-48 focus-within:w-64 transition-all duration-300">
              <Search size={14} className="text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-600 w-full"
              />
            </div>

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2.5 rounded-xl syn-glass pl-1.5 pr-3 py-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={avatarStyle}>
                {avatarInitial}
              </div>
              <span className="text-sm font-medium text-slate-200 hidden sm:block max-w-30 truncate">{displayName}</span>
            </div>

            <button
              onClick={logout}
              title="Log out"
              className="p-2.5 rounded-xl text-slate-500 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/25 active:scale-95 transition-all duration-200"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Main ─── */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-28">
        {/* Hero */}
        <header className="mb-12 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold uppercase tracking-[0.14em] mb-5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Work session active
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">
            Welcome back, <span className="syn-text-gradient">{displayName}</span>
          </h1>
          <p className="text-lg text-slate-500">Ready to build something amazing today?</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="syn-glass syn-card-hover rounded-2xl p-5 animate-fade-up"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${stat.chip}`}>
                  <stat.icon size={15} className={stat.accent} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{stat.label}</span>
              </div>
              <p className="font-display text-[26px] font-bold text-white tabular-nums leading-none">{stat.value}</p>
              {stat.meta && (
                <p className={`text-xs mt-2 ${stat.metaPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stat.meta}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Action cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {ACTIONS.map((action, i) => (
            <ActionCard key={action.to} action={action} index={i} />
          ))}
        </section>

        {/* Recent projects */}
        <section className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
            <div className="flex items-center gap-5 flex-wrap">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center">
                  <Clock size={17} className="text-sky-400" />
                </span>
                Recent Projects
              </h2>
              <div className="flex gap-1 p-1 rounded-xl syn-glass">
                {[
                  { id: 'recent', label: 'Recently Edited' },
                  { id: 'shared', label: 'Shared with Me' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-violet-500/20 text-white border border-violet-500/30 shadow-[0_0_16px_rgba(139,92,246,0.25)]'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="font-mono text-xs text-slate-600">
              {filteredRooms.length} room{filteredRooms.length === 1 ? '' : 's'}
            </span>
          </div>

          {loadingRooms ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="syn-glass rounded-2xl p-6 h-44">
                  <div className="h-4 w-24 rounded bg-white/6 mb-3 animate-shimmer bg-[linear-gradient(100deg,rgba(255,255,255,0.04)_30%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.04)_70%)] bg-size-200%_100%" />
                  <div className="h-6 w-40 rounded bg-white/6 mb-6 animate-shimmer bg-[linear-gradient(100deg,rgba(255,255,255,0.04)_30%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.04)_70%)] bg-size-200%_100%" />
                  <div className="h-4 w-full rounded bg-white/4" />
                </div>
              ))}
            </div>
          ) : filteredRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRooms.map((room, i) => {
                const fileCount = Array.isArray(room.files)
                  ? room.files.filter((f) => f.type === 'file').length
                  : 0;
                const canDeleteRoom = room.createdBy === user?.userId;
                return (
                  <div
                    key={room.roomId}
                    onClick={() => navigate(`/room/${room.roomId}`)}
                    className="syn-glass syn-card-hover group relative rounded-2xl p-6 cursor-pointer overflow-hidden animate-fade-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                  >
                    <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-violet-600/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="flex items-start justify-between mb-5 relative">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold text-slate-600 tracking-[0.18em] mb-1.5">{room.roomId}</p>
                        <h4 className="font-semibold text-slate-100 text-[16px] truncate group-hover:text-violet-300 transition-colors duration-200">
                          {room.roomName || 'Untitled Room'}
                        </h4>
                      </div>
                      {canDeleteRoom ? (
                        <button
                          title="Delete room"
                          onClick={(e) => handleDeleteClick(e, { roomId: room.roomId, roomName: room.roomName })}
                          className="p-2 rounded-lg text-slate-600 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/25 active:scale-95 transition-all duration-200 shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2.5 mb-5 relative">
                      <span className="rounded-md px-2 py-1 text-[10px] font-mono font-bold bg-white/6 border border-white/10 text-slate-400 uppercase tracking-wider">
                        Code
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <FileCode2 size={13} />
                        {fileCount} {fileCount === 1 ? 'file' : 'files'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/6 relative">
                      <span className="text-xs text-slate-600 italic">
                        Edited {timeAgo(room.lastUpdated, now)}
                      </span>
                      <div className="flex items-center">
                        <div
                          className="w-7 h-7 rounded-full border-2 border-void flex items-center justify-center text-[10px] font-bold"
                          style={avatarStyle}
                        >
                          {avatarInitial}
                        </div>
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          Open <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="syn-glass rounded-2xl py-16 px-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
                <FolderOpen size={24} className="text-violet-300" />
              </div>
              <p className="text-slate-300 font-semibold mb-1.5">
                {searchQuery
                  ? 'No rooms match your search.'
                  : activeTab === 'shared'
                    ? "You haven't joined any shared rooms yet."
                    : 'No rooms yet — let\'s fix that.'}
              </p>
              <p className="text-sm text-slate-500 mb-6">
                {searchQuery || activeTab === 'shared'
                  ? 'Try a different search or tab.'
                  : 'Create your first collaborative session to see it here.'}
              </p>
              {!searchQuery && activeTab !== 'shared' && (
                <Link to="/create-room" className="syn-btn-primary rounded-xl px-6 py-3 text-sm inline-flex">
                  <Plus size={16} /> Create your first room
                </Link>
              )}
            </div>
          )}
        </section>
      </main>

      {/* floating footer pill */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-2.5 rounded-full syn-glass-strong shadow-[0_20px_50px_-16px_rgba(0,0,0,0.8)] animate-fade-up">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">All systems live</span>
        </span>
        <span className="h-4 w-px bg-white/10" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {joinedRoomCount} room{joinedRoomCount === 1 ? '' : 's'} joined
        </span>
      </div>

      {/* Delete confirmation modal */}
      {roomToDelete && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setRoomToDelete(null)}>
          <div
            className="relative syn-glass-strong rounded-2xl p-8 w-full max-w-md shadow-[0_32px_80px_-16px_rgba(0,0,0,0.85)] animate-scale-in text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
              <Trash2 size={24} className="text-red-400" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-3">Delete room?</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              <span className="text-slate-100 font-semibold">{roomToDelete.roomName || roomToDelete.roomId}</span>
              {' '}will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setRoomToDelete(null)}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-slate-300 bg-white/6 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRoom}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-white bg-red-500/90 border border-red-400/30 hover:bg-red-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 shadow-[0_10px_28px_-8px_rgba(239,68,68,0.6)]"
              >
                Delete room
              </button>
            </div>
            <button
              onClick={() => setRoomToDelete(null)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] transition-all"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
