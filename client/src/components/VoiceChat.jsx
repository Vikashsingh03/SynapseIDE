import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  X,
  LoaderCircle,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { getLivekitToken, endLivekitMeeting } from '../services/livekitService';
import { getThemeClasses } from '../utils/theme';
import { getUserInitial } from '../utils/avatar';

/* ── Inner room UI (must live inside <LiveKitRoom>) ── */

function ParticipantCount() {
  const participants = useParticipants();
  return (
    <span className="font-mono text-[11px] text-[#8290a8] flex items-center gap-1.5">
      <Users size={12} />
      {participants.length} in call
    </span>
  );
}

function CallGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-14 h-14 rounded-xl bg-[#d9ff3f]/10 border border-[#d9ff3f]/25 flex items-center justify-center">
          <Mic size={22} className="text-[#d9ff3f]" />
        </div>
        <p className="text-sm font-semibold text-[#dce5f3]">You&apos;re in the call</p>
        <p className="font-mono text-[11px] text-[#8290a8] leading-relaxed">
          Waiting for others to join…
          <br />
          Share the room link to invite them.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 p-3">
      <GridLayout tracks={tracks} className="h-full">
        <ParticipantTile className="syn-voice-tile" />
      </GridLayout>
    </div>
  );
}

function ControlBar({ roomId, onLeave }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const btn =
    'w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95';

  const handleEndForAll = async () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      setTimeout(() => setConfirmEnd(false), 4000);
      return;
    }
    setEnding(true);
    try {
      await endLivekitMeeting(roomId);
    } catch {
      // Even if the API fails, leave locally — the room will
      // expire on its own via LiveKit's empty timeout.
    } finally {
      onLeave();
    }
  };

  return (
    <div className="shrink-0 px-4 py-3 border-t border-[#283348] bg-[#10151f]">
      <div className="flex items-center justify-center gap-2.5">
        <TrackToggle
          source={Track.Source.Microphone}
          className={`${btn} border-[#283348] bg-[#1a2230] text-[#dce5f3] hover:bg-[#232d40] data-[enabled=false]:bg-[#ff4d35]/15 data-[enabled=false]:border-[#ff4d35]/40 data-[enabled=false]:text-[#ff4d35]`}
          aria-label="Toggle microphone"
        >
          <Mic size={17} className="hidden group-data-[enabled=true]:block" />
        </TrackToggle>

        <TrackToggle
          source={Track.Source.Camera}
          className={`${btn} border-[#283348] bg-[#1a2230] text-[#dce5f3] hover:bg-[#232d40] data-[enabled=false]:bg-[#ff4d35]/15 data-[enabled=false]:border-[#ff4d35]/40 data-[enabled=false]:text-[#ff4d35]`}
          aria-label="Toggle camera"
        />

        <TrackToggle
          source={Track.Source.ScreenShare}
          className={`${btn} border-[#283348] bg-[#1a2230] text-[#dce5f3] hover:bg-[#232d40] data-[enabled=true]:bg-[#1557ff]/20 data-[enabled=true]:border-[#1557ff]/50 data-[enabled=true]:text-[#70a5ff]`}
          aria-label="Share screen"
        />

        <button
          onClick={onLeave}
          aria-label="Leave call"
          title="Leave call (only you)"
          className={`${btn} bg-[#ff4d35] border-[#ff4d35] text-white hover:bg-[#e6432c] shadow-[3px_3px_0_rgba(0,0,0,0.4)]`}
        >
          <PhoneOff size={17} />
        </button>
      </div>
      <button
        onClick={handleEndForAll}
        disabled={ending}
        className={`w-full text-center font-mono text-[10px] mt-2.5 transition-colors cursor-pointer disabled:opacity-50 ${
          confirmEnd ? 'text-[#ff4d35] font-bold' : 'text-[#8290a8] hover:text-[#ff4d35]'
        }`}
      >
        {ending ? 'Ending meeting…' : confirmEnd ? 'Tap again to end for EVERYONE' : 'End meeting for everyone'}
      </button>
    </div>
  );
}

function VoiceRoom({ roomId, onLeave, onError }) {
  return (
    <div className="flex flex-col h-full bg-[#121824]">
      <div className="shrink-0 px-4 py-3 border-b border-[#283348] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d9ff3f] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#d9ff3f]" />
          </span>
          <span className="text-sm font-extrabold text-[#dce5f3] tracking-tight">Voice Chat</span>
          <ParticipantCount />
        </div>
        <button
          onClick={onLeave}
          aria-label="Close voice chat"
          className="p-1.5 rounded-md text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/5 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <RoomAudioRenderer />
      <CallGrid />
      <ControlBar roomId={roomId} onLeave={onLeave} />
    </div>
  );
}

/* ── Public component: fetches token, then mounts the room ── */

export default function VoiceChat({ roomId, theme, onClose }) {
  const t = getThemeClasses(theme);
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getLivekitToken(roomId)
      .then((data) => {
        if (!cancelled) setTokenData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err.message || 'Could not join voice chat.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 bg-[#121824] p-6">
        <LoaderCircle size={26} className="animate-spin text-[#d9ff3f]" />
        <p className="font-mono text-[12px] text-[#8290a8]">Joining voice chat…</p>
      </div>
    );
  }

  if (error || !tokenData?.token) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 bg-[#121824] p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#ff4d35]/10 border border-[#ff4d35]/30 flex items-center justify-center">
          <AlertTriangle size={20} className="text-[#ff4d35]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#dce5f3] mb-1.5">Voice chat unavailable</p>
          <p className="text-[12px] text-[#8290a8] leading-relaxed max-w-60">{error}</p>
        </div>
        {error.includes('not configured') && (
          <p className="font-mono text-[10px] text-[#8290a8] leading-relaxed max-w-65 border border-[#283348] rounded-lg p-3 bg-[#10151f]">
            Ask the server admin to add
            <br />
            LIVEKIT_API_KEY / SECRET / URL
            <br />
            to server/.env
          </p>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-[#283348] text-[13px] font-bold text-[#dce5f3] hover:bg-white/5 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.url}
      connect
      audio
      video={false}
      onDisconnected={onClose}
      onError={(e) => setError(e.message)}
      className="h-full"
    >
      <VoiceRoom roomId={roomId} onLeave={onClose} />
    </LiveKitRoom>
  );
}
