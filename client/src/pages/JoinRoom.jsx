import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Users, ClipboardPaste, Zap } from 'lucide-react';
import { getRoom } from '../services/roomService';
import SynapseInteractiveBackground from '../components/SynapseInteractiveBackground';
import SynapseLogo from '../components/SynapseLogo';

export default function JoinRoom() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.backgroundColor = '#05070d';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

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
      /* clipboard unavailable — user can type manually */
    }
  };

  return (
    <div className="min-h-screen bg-void text-slate-200 syn-noise relative overflow-hidden flex items-center justify-center p-6">
      <SynapseInteractiveBackground />

      {/* aurora orbs */}
      <div className="pointer-events-none fixed inset-0 z-1">
        <div className="absolute top-1/4 right-1/4 h-80 w-80 rounded-full bg-indigo-600/20 blur-[120px] animate-aurora" />
        <div className="absolute bottom-1/4 left-1/4 h-80 w-80 rounded-full bg-violet-600/15 blur-[120px] animate-aurora" style={{ animationDelay: '-11s' }} />
      </div>

      <div className="relative z-10 w-full max-w-115 animate-scale-in">
        <Link to="/dashboard" className="flex items-center justify-center gap-2.5 mb-8 group">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.4)] group-hover:scale-105 transition-transform duration-200">
            <SynapseLogo size={22} color="#ffffff" nodeColor="#ffffff" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white uppercase">Synapse</span>
        </Link>

        <div className="syn-glass rounded-3xl p-8 sm:p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)]">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
              <Users size={22} className="text-violet-300" />
            </div>
            <h1 className="font-display text-[26px] font-bold tracking-tight text-white mb-2">
              Join a live coding room
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Paste the room code you received and we&apos;ll connect you to the shared editor.
            </p>
          </div>

          {error ? (
            <div key={error} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-[13px] mb-6 animate-[authShake_0.4s_ease-out]">
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleJoinRoom} className="flex flex-col gap-5">
            <div>
              <label className="block text-[13px] font-medium text-slate-400 mb-2" htmlFor="roomId">
                Room code
              </label>
              <div className="relative">
                <input
                  id="roomId"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value.toUpperCase())}
                  className="w-full rounded-xl syn-input pl-4 pr-12 h-15 font-mono text-xl tracking-[0.35em] text-center text-slate-100 placeholder:text-slate-700 placeholder:tracking-[0.35em]"
                  placeholder="ABC123"
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteCode}
                  title="Paste from clipboard"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-violet-300 hover:bg-violet-500/10 active:scale-95 transition-all duration-200"
                >
                  <ClipboardPaste size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2 text-center">
                6-character code — usually looks like <span className="font-mono text-slate-500">X7K2P9</span>
              </p>
            </div>

            <button type="submit" className="syn-btn-primary w-full h-13 rounded-xl text-[15px]" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2.5">
                  <Loader2 size={18} className="animate-spin" />
                  Joining room...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>Join room</span>
                  <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>

          <div className="text-center mt-7 pt-6 border-t border-white/[0.07] text-[13px] text-slate-500">
            Need a fresh workspace?{' '}
            <Link to="/create-room" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Create a room
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-600">
          <Zap size={13} className="text-violet-400" />
          You&apos;ll be connected to live cursors, chat and shared execution
        </div>
      </div>
    </div>
  );
}
