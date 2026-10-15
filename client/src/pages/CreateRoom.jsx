import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Plus, Check, Waypoints } from 'lucide-react';
import { createRoom } from '../services/roomService';
import { getThemeClasses } from '../utils/theme';
import { readStorage } from '../utils/storage';

const STEPS = ['Name your room', 'Share & collaborate'];

export default function CreateRoom() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');

  const [theme] = useState(() => readStorage('synapse-theme') || 'dark');
  const t = getThemeClasses(theme);
  const dark = theme === 'dark';

  useEffect(() => {
    document.body.style.backgroundColor = dark ? '#111310' : '#f3f1eb';
    return () => { document.body.style.backgroundColor = ''; };
  }, [dark]);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError('');
      const { room } = await createRoom(roomName || 'System Design Practice');
      navigate(`/room/${room.roomId}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
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
          { }
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold border ${
                    i === 0
                      ? 'border-(--blue) text-(--blue)'
                      : `${t.border} ${t.textMuted2}`
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`font-mono text-[11px] font-bold uppercase tracking-[0.06em] hidden sm:block ${i === 0 ? t.textPrimary : t.textMuted2}`}>
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px border-t ${t.divider} mx-1`} />}
              </div>
            ))}
          </div>

          <div className="text-center mb-8">
            <div className={`w-10 h-10 rounded-lg border ${t.border} flex items-center justify-center mx-auto mb-4 bg-(--paper-2)`}>
              <Plus size={18} className={t.textSecondary} />
            </div>
            <h1 className={`text-2xl font-extrabold tracking-[-0.02em] ${t.textPrimary} mb-2`}>
              Create a collaboration room
            </h1>
            <p className={`text-sm ${t.textSecondary} leading-relaxed`}>
              Generate a shared workspace, invite your teammates, and start editing code in real time.
            </p>
          </div>

          {error ? (
            <div key={error} className={`px-4 py-3 rounded-lg border text-[13px] mb-6 animate-fade-in ${dark ? 'border-(--red)/30 bg-(--red)/8 text-(--red)' : 'border-(--red)/25 bg-(--red)/6 text-(--red-deep)'}`}>
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mb-6">
            <label className={`block font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${t.textSecondary} mb-2`} htmlFor="roomName">
              Room name
            </label>
            <input
              id="roomName"
              type="text"
              placeholder="e.g. System Design Practice"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRoom();
              }}
              className={t.input}
              autoFocus
            />
            <p className={`text-xs ${t.textMuted2} mt-2`}>Leave blank for a default name.</p>
          </div>

          <button onClick={handleCreateRoom} className={`${t.btnAccent} w-full`} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating room...
              </>
            ) : (
              <>
                Create room
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className={`text-center mt-6 pt-6 border-t ${t.divider} text-[13px] ${t.textMuted2}`}>
            Prefer joining an existing session?{' '}
            <Link to="/join-room" className="font-bold text-(--blue) hover:underline underline-offset-4 transition-all">
              Use a room code
            </Link>
          </div>
        </div>

        <div className={`mt-6 flex items-center justify-center gap-2 text-xs ${t.textMuted2}`}>
          <Check size={13} className="text-emerald-500" />
          <span className="font-mono">You&apos;ll get a shareable invite link right after creation</span>
        </div>
      </div>
    </div>
  );
}
