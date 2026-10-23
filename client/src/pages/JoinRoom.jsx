import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, Users, ClipboardPaste, Zap, Waypoints } from 'lucide-react';
import { getRoom } from '../services/roomService';
import { extractInviteCode } from '../utils/inviteLink';
import { getThemeClasses } from '../utils/theme';
import { readStorage } from '../utils/storage';

export default function JoinRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [fromLink, setFromLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [theme] = useState(() => readStorage('synapse-theme') || 'dark');
  const t = getThemeClasses(theme);
  const dark = theme === 'dark';

  useEffect(() => {
    document.body.style.backgroundColor = dark ? '#111310' : '#f3f1eb';
    return () => { document.body.style.backgroundColor = ''; };
  }, [dark]);

  useEffect(() => {
    const code = extractInviteCode(searchParams.toString());
    if (code) {
      setRoomId(code.toUpperCase().slice(0, 6));
      setFromLink(true);
    }
  }, [searchParams]);

  const handleJoinRoom = async (event) => {
    event.preventDefault();

    const normalizedRoomId = roomId.trim().toUpperCase();
    if (!normalizedRoomId) {
      setError('Enter a room code to continue.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await getRoom(normalizedRoomId);
      navigate(`/room/${normalizedRoomId}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomId(text.trim().toUpperCase().slice(0, 6));
        setError('');
      }
    } catch {
       
    }
  };

  return (
    <div className={`min-h-screen syn-grain ${t.page} flex items-center justify-center p-6`}>
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/dashboard" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="w-9 h-9 rounded-lg bg-(--red) flex items-center justify-center shadow-[2px_2px_0_var(--ink)]">
            <Waypoints size={17} className="text-white" />
          </span>
          <span className={`text-[16px] font-extrabold tracking-tight ${t.textPrimary}`}>Synapse</span>
        </Link>

        <div className={`${t.card} p-8`}>
          <div className="text-center mb-8">
            <div className={`w-10 h-10 rounded-lg border ${t.border} flex items-center justify-center mx-auto mb-4 bg-(--paper-2)`}>
              <Users size={18} className={t.textSecondary} />
            </div>
            <h1 className={`text-2xl font-extrabold tracking-[-0.02em] ${t.textPrimary} mb-2`}>
              Join a live coding room
            </h1>
            <p className={`text-sm ${t.textSecondary} leading-relaxed`}>
              Paste the room code you received and we&apos;ll connect you to the shared editor.
            </p>
          </div>

          {error ? (
            <div key={error} className={`px-4 py-3 rounded-lg border text-[13px] mb-6 animate-fade-in ${dark ? 'border-(--red)/30 bg-(--red)/8 text-(--red)' : 'border-(--red)/25 bg-(--red)/6 text-(--red-deep)'}`}>
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleJoinRoom} className="flex flex-col gap-5">
            <div>
              <label className={`block font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${t.textSecondary} mb-2`} htmlFor="roomId">
                Room code
              </label>
              <div className="relative">
                <input
                  id="roomId"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value.toUpperCase())}
                  className={`w-full rounded-lg border ${t.border} bg-(--panel) h-14 px-4 pr-12 text-center font-mono text-lg font-bold tracking-[0.3em] outline-none transition-colors ${t.textPrimary} placeholder:text-(--muted) focus:border-(--blue)`}
                  placeholder="ABC123"
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteCode}
                  title="Paste from clipboard"
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.iconBtn}`}
                >
                  <ClipboardPaste size={16} />
                </button>
              </div>
              <p className={`text-xs ${t.textMuted2} mt-2 text-center font-mono`}>
                6-character code — usually looks like <span className="font-bold">X7K2P9</span>
              </p>
              {fromLink ? (
                <p className="text-xs mt-2 text-center font-mono text-(--blue)">
                  Invite code filled from your link — just press Join.
                </p>
              ) : null}
            </div>

            <button type="submit" className={`${t.btnAccent} w-full`} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Joining room...
                </>
              ) : (
                <>
                  Join room
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className={`text-center mt-6 pt-6 border-t ${t.divider} text-[13px] ${t.textMuted2}`}>
            Need a fresh workspace?{' '}
            <Link to="/create-room" className="font-bold text-(--blue) hover:underline underline-offset-4 transition-all">
              Create a room
            </Link>
          </div>
        </div>

        <div className={`mt-6 flex items-center justify-center gap-2 text-xs ${t.textMuted2}`}>
          <Zap size={13} className="text-(--blue)" />
          <span className="font-mono">You&apos;ll be connected to live cursors, chat and shared execution</span>
        </div>
      </div>
    </div>
  );
}
