import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  AtSign,
  Users,
  Phone,
  Info,
  CheckCheck,
  X,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import { createCollaborationSocket } from '../services/socket';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';

const TYPE_ICON = {
  mention: AtSign,
  room_join: Users,
  voice_call: Phone,
  system: Info,
};

function timeAgo(value) {
  if (!value) return '';
  const s = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell({ theme }) {
  const t = getThemeClasses(theme);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);
  const socketRef = useRef(null);

  
  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((data) => {
        if (cancelled) return;
        setItems(data.notifications || []);
        setUnread(data.unreadCount || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  
  useEffect(() => {
    const socket = createCollaborationSocket();
    socketRef.current = socket;
    socket.connect();

    const onNotification = (notif) => {
      setItems((prev) => {
        if (prev.some((n) => String(n._id) === String(notif._id))) return prev;
        return [notif, ...prev].slice(0, 30);
      });
      setUnread((c) => c + 1);
    };

    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const handleOpen = async (notif) => {
    if (!notif.read) {
      try {
        await markNotificationRead(notif._id);
      } catch {}
      setItems((prev) => prev.map((n) => (String(n._id) === String(notif._id) ? { ...n, read: true } : n)));
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (notif.link) navigate(notif.link);
    else if (notif.roomId) navigate(`/room/${notif.roomId}`);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch {}
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        className={`${t.iconBtn} relative`}
      >
        {unread > 0 ? <BellRing size={17} /> : <Bell size={17} />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-(--red) text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-(--paper)">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`${t.card} absolute right-0 top-full mt-2 w-85 max-w-[90vw] max-h-105 flex flex-col overflow-hidden animate-fade-in z-80`}
        >
          <div className={`flex items-center justify-between px-4 py-3 border-b ${t.border} shrink-0`}>
            <span className={`text-sm font-extrabold ${t.textPrimary}`}>Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  title="Mark all as read"
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold ${t.textMuted} hover:text-(--ink) transition-colors`}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className={`${t.iconBtn} p-1!`} aria-label="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <p className={`text-center text-[13px] py-8 ${t.textMuted}`}>Loading…</p>
            ) : items.length === 0 ? (
              <div className={`flex flex-col items-center gap-2 py-10 ${t.textMuted}`}>
                <Bell size={28} />
                <p className="text-[13px]">No notifications yet</p>
                <p className="font-mono text-[11px] opacity-70">Someone @mentions you in chat → you&apos;ll see it here</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICON[n.type] || Info;
                return (
                  <button
                    key={n._id}
                    onClick={() => handleOpen(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b ${t.border} transition-colors hover:bg-(--ink)/4 ${
                      !n.read ? 'bg-(--blue)/6' : ''
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                        !n.read
                          ? 'bg-(--blue)/10 border-(--blue)/30 text-(--blue)'
                          : `bg-(--panel) ${t.border} ${t.textMuted}`
                      }`}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] font-bold ${t.textPrimary} truncate`}>{n.title}</span>
                      {n.message && (
                        <span className={`block text-[12px] ${t.textMuted} truncate mt-0.5`}>{n.message}</span>
                      )}
                      <span className={`block font-mono text-[10px] ${t.textMuted} mt-1 opacity-70`}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-(--blue) shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
