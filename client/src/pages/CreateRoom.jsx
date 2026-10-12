import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, PlusCircle, Check } from 'lucide-react';
import { createRoom } from '../services/roomService';
import SynapseInteractiveBackground from '../components/SynapseInteractiveBackground';
import SynapseLogo from '../components/SynapseLogo';

const STEPS = ['Name your room', 'Share & collaborate'];

export default function CreateRoom() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    document.body.style.backgroundColor = '#05070d';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

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
    <div className="min-h-screen bg-void text-slate-200 syn-noise relative overflow-hidden flex items-center justify-center p-6">
      <SynapseInteractiveBackground />

      {/* aurora orbs */}
      <div className="pointer-events-none fixed inset-0 z-1">
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-violet-600/20 blur-[120px] animate-aurora" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px] animate-aurora" style={{ animationDelay: '-9s' }} />
      </div>

      <div className="relative z-10 w-full max-w-115 animate-scale-in">
        <Link to="/dashboard" className="flex items-center justify-center gap-2.5 mb-8 group">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.4)] group-hover:scale-105 transition-transform duration-200">
            <SynapseLogo size={22} color="#ffffff" nodeColor="#ffffff" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white uppercase">Synapse</span>
        </Link>

        <div className="syn-glass rounded-3xl p-8 sm:p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)]">
          {/* step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all duration-300 ${
                    i === 0
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-200 shadow-[0_0_14px_rgba(139,92,246,0.35)]'
                      : 'bg-white/4 border-white/10 text-slate-500'
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`text-xs font-medium hidden sm:block ${i === 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-linear-to-r from-violet-500/40 to-white/10 mx-1" />}
              </div>
            ))}
          </div>

          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
              <PlusCircle size={22} className="text-violet-300" />
            </div>
            <h1 className="font-display text-[26px] font-bold tracking-tight text-white mb-2">
              Create a collaboration room
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Generate a shared workspace, invite your teammates, and start editing code in real time.
            </p>
          </div>

          {error ? (
            <div key={error} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-[13px] mb-6 animate-[authShake_0.4s_ease-out]">
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mb-6">
            <label className="block text-[13px] font-medium text-slate-400 mb-2" htmlFor="roomName">
              Room name
            </label>
            <div className="flex items-center gap-3 rounded-xl syn-input px-4 h-13">
              <input
                id="roomName"
                type="text"
                placeholder="e.g. System Design Practice"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateRoom();
                }}
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-600 mt-2">Leave blank for a default name.</p>
          </div>

          <button onClick={handleCreateRoom} className="syn-btn-primary w-full h-13 rounded-xl text-[15px]" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2.5">
                <Loader2 size={18} className="animate-spin" />
                Creating room...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Create room</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>

          <div className="text-center mt-7 pt-6 border-t border-white/[0.07] text-[13px] text-slate-500">
            Prefer joining an existing session?{' '}
            <Link to="/join-room" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Use a room code
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-600">
          <Check size={13} className="text-emerald-400" />
          You&apos;ll get a shareable invite link right after creation
        </div>
      </div>
    </div>
  );
}
