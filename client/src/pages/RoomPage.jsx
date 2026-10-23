import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';
import { useCallback } from 'react';
import { Loader2, AlertTriangle, ArrowLeft, Phone, X, Eye } from 'lucide-react';
import { FileProvider, useFiles } from '../contexts/FileContext';
import { useAuth } from '../context/useAuth';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import EditorPanel from '../components/EditorPanel';
import Toolbar from '../components/Toolbar';
import OutputPanel from '../components/OutputPanel';
import SnippetHost from '../components/SnippetHost';
import { ProjectTemplatesHost } from '../components/ProjectTemplatesModal';
import { PracticeHost } from '../components/PracticePanel';
import Breadcrumbs from '../components/Breadcrumbs';
import { RenameSymbolHost } from '../components/RenameSymbolModal';
import { DebugHost } from '../components/DebugPanel';
import { ExtensionsHost } from '../components/ExtensionsPanel';
import { NotebookHost } from '../components/NotebookPanel';
import { RestHost } from '../components/RestPanel';
import { DbHost } from '../components/DbPanel';
import { DeployHost } from '../components/DeployPanel';
import { DockerHost } from '../components/DockerPanel';
import { TasksHost } from '../components/TasksPanel';
import { PreviewHost } from '../components/PreviewPanel';
import { TestHost } from '../components/TestPanel';
import { TimelineHost } from '../components/TimelinePanel';
import { ReadmeHost } from '../components/ReadmeModal';
import { DiffHost } from '../components/DiffModal';
import MarkdownPreviewHost from '../components/MarkdownPreviewModal';
import GitHubImportHost from '../components/GitHubImportModal';
import { QuickOpenHost } from '../components/QuickOpen';
import StatusBar from '../components/StatusBar';
import NeuraPanel from '../components/NeuraPanel';
import VoiceChat from '../components/VoiceChat';
import { getThemeClasses } from '../utils/theme';
import { createCollaborationSocket } from '../services/socket';
import { getRoom } from '../services/roomService';
import { RoomYjsManager } from '../services/yjsRoom';
import { copyText } from '../utils/clipboard';
import { readStorage, writeStorage } from '../utils/storage';
import CommandPalette from '../components/CommandPalette';
import CodeReviewModal from '../components/CodeReviewModal';
import { useEditorSettings } from '../hooks/useEditorSettings';

const FILE_LOCK_RENEW_INTERVAL_MS = 15000;

function getStructureSignature({ files = [] }) {
  return JSON.stringify({
    files: files.map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      parentId: file.parentId,
      order: file.order,
    })),
  });
}

function RoomSession({ roomId }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { files, activeFileId, openTabs, updateContent, replaceState, replaceSharedFiles } = useFiles();
  const prevFilesRef = useRef([]);
  const [theme, setTheme] = useState(() => readStorage('synapse-theme') || 'dark');

  
  const [paletteOpen, setPaletteOpen] = useState(false);
  const {
    settings: editorSettings,
    increaseFont,
    decreaseFont,
    toggleWordWrap,
    toggleMinimap,
    cycleEditorTheme,
    cycleFontFamily,
    cycleTabSize,
    toggleFormatOnType,
    toggleStickyScroll,
  } = useEditorSettings();

  
  const [reviewOpen, setReviewOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    const openReview = () => setReviewOpen(true);
    const toggleZen = () => setZenMode((v) => !v);
    const cycleTheme = () => cycleEditorTheme();
    window.addEventListener('synapse:review-code', openReview);
    window.addEventListener('synapse:toggle-zen', toggleZen);
    window.addEventListener('synapse:cycle-editor-theme', cycleTheme);
    return () => {
      window.removeEventListener('synapse:review-code', openReview);
      window.removeEventListener('synapse:toggle-zen', toggleZen);
      window.removeEventListener('synapse:cycle-editor-theme', cycleTheme);
    };
  }, [cycleEditorTheme]);

  useEffect(() => {
    const onKey = (e) => {
      const isK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey;
      const isVSCodeStyle = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p';
      if (isK || isVSCodeStyle) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  
  useEffect(() => {
    const open = () => setPaletteOpen(true);
    window.addEventListener('synapse:open-palette', open);
    return () => window.removeEventListener('synapse:open-palette', open);
  }, []);
  const [output, setOutput] = useState({
    stdout: '',
    stderr: '',
    compile_output: '',
    status: null,
    error: null,
    running: false,
  });
  const [connectionState, setConnectionState] = useState('connecting');
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomReady, setRoomReady] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [presence, setPresence] = useState({});
  const [myRole, setMyRole] = useState('editor');
  const [yjsManager, setYjsManager] = useState(null);
  const [, setYjsDocVersion] = useState(0);
  const [editingUsers, setEditingUsers] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [fileLocks, setFileLocks] = useState({});
  const [roomName, setRoomName] = useState('');
  const [lockNotice, setLockNotice] = useState('');
  const socketRef = useRef(null);
  const suppressStructureSyncRef = useRef(null);
  const copyTimerRef = useRef(null);
  const lockNoticeTimerRef = useRef(null);
  const structureEmitterRef = useRef(null);
  const cursorEmitterRef = useRef(null);
  const selectionEmitterRef = useRef(null);
  const editingTimersRef = useRef({});
  const ownedLockRef = useRef(null);
  const canEditFileRef = useRef(() => true);
  const localChangeEmitterRef = useRef(() => {});
  const latestRoomStateRef = useRef({
    files: [],
    activeFileId: null,
    openTabs: [],
  });

  const activeFileLock = activeFileId ? fileLocks[activeFileId] || null : null;
  const isActiveFileLockedByOther = Boolean(
    activeFileLock && activeFileLock.userId && activeFileLock.userId !== user?.userId
  );

  const canEditFile = useCallback(
    (fileId) => {
      if (!fileId) {
        return false;
      }
      if (myRole === 'viewer') {
        return false;
      }

      const lock = fileLocks[fileId];
      return !lock || lock.userId === user?.userId;
    },
    [fileLocks, user?.userId, myRole]
  );

  const showLockNotice = useCallback((message) => {
    setLockNotice(message);
    clearTimeout(lockNoticeTimerRef.current);
    lockNoticeTimerRef.current = setTimeout(() => {
      setLockNotice('');
    }, 3500);
  }, []);

  useEffect(() => {
    canEditFileRef.current = canEditFile;
  }, [canEditFile]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('synapse:room-role', { detail: { role: myRole, roomId } })
    );
  }, [myRole, roomId]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    writeStorage('synapse-theme', nextTheme);
  };

  const structureSignature = useMemo(
    () =>
      getStructureSignature({
        files,
      }),
    [files]
  );

  const handleLocalChange = useCallback((fileId, content) => {
    localChangeEmitterRef.current(fileId, content);
  }, []);

  const handleSaveVersion = useCallback(() => {
    if (myRole === 'viewer') {
      return;
    }
    if (socketRef.current && activeFileId && yjsManager) {
      const content = yjsManager.getText(activeFileId).toString();
      socketRef.current.emit('save-version', { roomId, fileId: activeFileId, content });
    }
  }, [activeFileId, yjsManager, roomId, myRole]);

  useEffect(() => {
    latestRoomStateRef.current = {
      files: files.map(({ id, name, type, parentId, order, content, updatedAt }) => ({
        id,
        name,
        type,
        parentId,
        order,
        content,
        updatedAt,
      })),
      activeFileId,
      openTabs,
    };
  }, [files, activeFileId, openTabs]);

  useEffect(() => {
    const debouncedEmitter = debounce((fileId, content) => {
      socketRef.current?.emit('autosave', { roomId, fileId, content });
    }, 1500);

    localChangeEmitterRef.current = debouncedEmitter;

    return () => {
      debouncedEmitter.cancel();
      localChangeEmitterRef.current = () => {};
    };
  }, [roomId]);

  useEffect(() => {
    if (!user?.userId || !user?.name) {
      return undefined;
    }

    const socket = createCollaborationSocket();
    socketRef.current = socket;

    const manager = new RoomYjsManager({
      socket,
      roomId,
      userId: user.userId,
      canEditFile: (fileId) => canEditFileRef.current(fileId),
      onFileContent: (fileId, content) => {
        updateContent(fileId, content, { updatedAt: Date.now() });
      },
      onDocReplaced: () => {
        setYjsDocVersion((version) => version + 1);
      },
    });
    setYjsManager(manager);

    const throttledStateSync = throttle((payload) => {
      socket.emit('sync-room-state', payload);
    }, 120, { leading: true, trailing: true });

    const throttledCursorSync = throttle((position) => {
      socket.emit('cursor-move', {
        roomId,
        userId: user.userId,
        username: user.name,
        position,
      });
    }, 50, { leading: true, trailing: true });

    const throttledSelectionSync = throttle((selectionRange) => {
      socket.emit('selection-change', {
        roomId,
        userId: user.userId,
        username: user.name,
        selectionRange,
      });
    }, 50, { leading: true, trailing: true });

    structureEmitterRef.current = throttledStateSync;
    cursorEmitterRef.current = throttledCursorSync;
    selectionEmitterRef.current = throttledSelectionSync;

    const handleConnect = () => {
      setConnectionState('connected');
      setError('');
      socket.emit('join-room', {
        roomId,
        username: user.name,
        userId: user.userId,
      });
    };

    const handleDisconnect = () => {
      setConnectionState('disconnected');
    };

    const handleConnectError = (connectError) => {
      setConnectionState('disconnected');
      setLoadingRoom(false);
      setRoomReady(false);
      setError(connectError.message || 'Failed to connect to the collaboration server.');
      if (/expired|invalid|auth/i.test(connectError.message || '')) {
        logout();
        navigate('/login');
      }
    };

    const applySharedDocs = (sharedDocs, nextFiles) => {
      manager.applySharedStates(sharedDocs, nextFiles);
    };

    const handleRoomJoined = ({ room, sharedDocs, fileLocks: initialFileLocks, participant }) => {
      suppressStructureSyncRef.current = getStructureSignature(room);
      setRoomName(room.roomName || '');
      replaceState(room);
      applySharedDocs(sharedDocs, room.files);
      setFileLocks(initialFileLocks || {});
      setLoadingRoom(false);
      setRoomReady(true);
      setError('');
      if (participant) {
        if (participant.role) {
          setMyRole(participant.role);
        }
        setPresence((previous) => ({
          ...previous,
          [participant.userId]: {
            userId: participant.userId,
            username: participant.username,
            cursorColor: participant.cursorColor,
            avatarGlyph: participant.avatarGlyph,
            role: participant.role,
          },
        }));
      }
      socket.emit('request-chat-history', { roomId, limit: 50 });
    };

    const handleRoomUsers = (nextParticipants) => {
      setPresence((previous) => {
        const nextPresence = {};
        nextParticipants.forEach((participant) => {
          nextPresence[participant.userId] = {
            ...previous[participant.userId],
            userId: participant.userId,
            username: participant.username,
            cursorColor: participant.cursorColor,
            avatarGlyph: participant.avatarGlyph,
            role: participant.role,
          };
        });
        return nextPresence;
      });
    };

    const handleRoomStateUpdated = (nextState) => {
      suppressStructureSyncRef.current = getStructureSignature(nextState);
      replaceSharedFiles(nextState);
      applySharedDocs(nextState.sharedDocs, nextState.files);
    };

    const handleRemoteCodeChange = ({ fileId, changes }) => {
      manager.applyRemoteUpdate(fileId, changes);
    };

    const handleUserEditing = ({ userId: peerId, username: peerName, cursorColor: peerColor, fileId }) => {
      setEditingUsers((prev) => ({
        ...prev,
        [peerId]: {
          userId: peerId,
          username: peerName,
          cursorColor: peerColor,
          fileId,
          lastEdit: Date.now(),
        },
      }));
      
      clearTimeout(editingTimersRef.current[peerId]);
      editingTimersRef.current[peerId] = setTimeout(() => {
        setEditingUsers((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }, 2000);
    };

    const handleCursorUpdate = (payload) => {
      setPresence((previous) => ({
        ...previous,
        [payload.userId]: {
          ...previous[payload.userId],
          userId: payload.userId,
          username: payload.username,
          cursorColor: payload.cursorColor,
          avatarGlyph: payload.avatarGlyph,
          position: payload.position,
          socketId: payload.socketId,
        },
      }));
    };

    const handleSelectionUpdate = (payload) => {
      setPresence((previous) => ({
        ...previous,
        [payload.userId]: {
          ...previous[payload.userId],
          userId: payload.userId,
          username: payload.username,
          cursorColor: payload.cursorColor,
          avatarGlyph: payload.avatarGlyph,
          selectionRange: payload.selectionRange,
          socketId: payload.socketId,
        },
      }));
    };

    const handleUserJoined = ({ username, cursorColor, avatarGlyph, userId, role }) => {
      setPresence((previous) => ({
        ...previous,
        [userId]: {
          ...previous[userId],
          userId,
          username,
          cursorColor,
          avatarGlyph,
          role,
        },
      }));
    };

    const handleRoomRole = ({ role, roomId: roleRoomId } = {}) => {
      if (roleRoomId && roleRoomId !== roomId) {
        return;
      }
      if (role) {
        setMyRole(role);
      }
    };

    const handleUserLeft = ({ userId }) => {
      if (!userId) {
        return;
      }

      setPresence((previous) => {
        const nextState = { ...previous };
        delete nextState[userId];
        return nextState;
      });
    };

    const handleRoomError = ({ message }) => {
      setLoadingRoom(false);
      setRoomReady(false);
      setError(message);
    };

    const handleFileLocksUpdated = ({ locks = {} }) => {
      setFileLocks(locks);
    };

    const handleLockDenied = ({ fileId, lockedBy }) => {
      const lockedFile = latestRoomStateRef.current.files.find((file) => file.id === fileId);
      const label = lockedFile?.name || 'This file';
      showLockNotice(`${label} is locked by ${lockedBy?.username || 'another user'}`);
      if (ownedLockRef.current === fileId) {
        ownedLockRef.current = null;
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('room-joined', handleRoomJoined);
    socket.on('room-role', handleRoomRole);
    socket.on('room-users', handleRoomUsers);
    socket.on('room-state-updated', handleRoomStateUpdated);
    socket.on('remote-code-change', handleRemoteCodeChange);
    socket.on('user-editing', handleUserEditing);
    socket.on('cursor-update', handleCursorUpdate);
    socket.on('selection-update', handleSelectionUpdate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('room-error', handleRoomError);
    socket.on('file-locks-updated', handleFileLocksUpdated);
    socket.on('lock-denied', handleLockDenied);
    socket.on('chat-message', (msg) => setChatMessages((prev) => [...prev, msg]));
    socket.on('chat-history', (history = []) => {
      setChatMessages((prev) => {
        const merged = [...history, ...prev];
        const seen = new Set();

        return merged
          .filter((message) => {
            const key = message?._id || `${message?.timestamp}-${message?.content}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          })
          .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
      });
    });
    socket.on('chat-message-updated', (updated) => {
      setChatMessages((prev) => prev.map(m => (m._id === updated._id ? updated : m)));
    });
    socket.on('chat-search-results', (results) => {
      
      window.dispatchEvent(new CustomEvent('chat-search-results', { detail: results }));
    });
    socket.on('user-typing', ({ userId: tid, username: tname, isTyping }) => {
      setTypingUsers((prev) => {
        if (!isTyping) { const n = { ...prev }; delete n[tid]; return n; }
        return { ...prev, [tid]: tname };
      });
    });
    socket.connect();

    return () => {
      throttledStateSync.cancel();
      throttledCursorSync.cancel();
      throttledSelectionSync.cancel();
      structureEmitterRef.current = null;
      cursorEmitterRef.current = null;
      selectionEmitterRef.current = null;
      clearTimeout(copyTimerRef.current);
      clearTimeout(lockNoticeTimerRef.current);
      Object.values(editingTimersRef.current).forEach(clearTimeout);
      editingTimersRef.current = {};
      socket.off('file-locks-updated', handleFileLocksUpdated);
      socket.off('lock-denied', handleLockDenied);
      socket.off('chat-message');
      socket.off('chat-history');
      socket.off('chat-message-updated');
      socket.off('chat-search-results');
      socket.off('user-typing');
      socket.emit('leave-room');
      socket.disconnect();
      manager.destroy();
      setYjsManager(null);
    };
  }, [logout, navigate, replaceSharedFiles, replaceState, roomId, showLockNotice, updateContent, user]);

  useEffect(() => {
    let cancelled = false;

    async function validateRoom() {
      try {
        await getRoom(roomId);
      } catch (requestError) {
        if (!cancelled) {
          setLoadingRoom(false);
          setRoomReady(false);
          setError(requestError.message);
        }
      }
    }

    validateRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || connectionState !== 'connected' || loadingRoom || !roomReady) {
      return;
    }

    if (suppressStructureSyncRef.current === structureSignature) {
      suppressStructureSyncRef.current = null;
      return;
    }
    suppressStructureSyncRef.current = null;

    structureEmitterRef.current?.(latestRoomStateRef.current);
  }, [structureSignature, connectionState, loadingRoom, roomReady]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || connectionState !== 'connected' || !roomReady) {
      return undefined;
    }

    const previousFileId = ownedLockRef.current;
    if (previousFileId && previousFileId !== activeFileId) {
      socket.emit('release-file-lock', { roomId, fileId: previousFileId });
      ownedLockRef.current = null;
    }

    if (!activeFileId) {
      return undefined;
    }

    socket.emit('request-file-lock', { roomId, fileId: activeFileId });
    ownedLockRef.current = activeFileId;

    const renewTimer = window.setInterval(() => {
      socket.emit('renew-file-lock', { roomId, fileId: activeFileId });
    }, FILE_LOCK_RENEW_INTERVAL_MS);

    return () => {
      window.clearInterval(renewTimer);
    };
  }, [activeFileId, connectionState, roomId, roomReady]);

  useEffect(() => {
    if (!ownedLockRef.current) {
      return;
    }

    const stillExists = files.some((file) => file.id === ownedLockRef.current);
    if (stillExists) {
      return;
    }

    socketRef.current?.emit('release-file-lock', { roomId, fileId: ownedLockRef.current });
    ownedLockRef.current = null;
  }, [files, roomId]);

  
  
  
  const sharedText = activeFileId && yjsManager ? yjsManager.getText(activeFileId) : null;

  
  
  
  useEffect(() => {
    if (!yjsManager || !roomReady) return;
    const prevIds = new Set(prevFilesRef.current.map((f) => f.id));
    files.forEach((file) => {
      if (!prevIds.has(file.id)) {
        yjsManager.seedNewFile(file.id, file.content || '');
      }
    });
    prevFilesRef.current = files;
  }, [files, yjsManager, roomReady]);

  const handleCursorMove = (position) => {
    if (!cursorEmitterRef.current || !activeFileId) {
      return;
    }

    cursorEmitterRef.current({
      fileId: activeFileId,
      lineNumber: position.lineNumber,
      column: position.column,
    });
  };

  const handleSelectionChange = (selectionRange) => {
    if (!selectionEmitterRef.current || !activeFileId) {
      return;
    }

    selectionEmitterRef.current({
      ...selectionRange,
      fileId: activeFileId,
    });
  };

  const handleCopyInvite = async () => {
    const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(
      /\/+$/,
      ''
    );
    const inviteLink = `${publicAppUrl}/room/${roomId}`;

    try {
      const didCopy = await copyText(inviteLink);
      if (!didCopy) {
        throw new Error('Copy failed');
      }
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the invite link from this browser.');
    }
  };

  const handleExitRoom = useCallback(() => {
    const socket = socketRef.current;

    structureEmitterRef.current?.cancel?.();
    localChangeEmitterRef.current?.cancel?.();

    if (socket?.connected) {
      if (roomReady) {
        socket.emit('sync-room-state', latestRoomStateRef.current);
      }
      if (ownedLockRef.current) {
        socket.emit('release-file-lock', { roomId, fileId: ownedLockRef.current });
        ownedLockRef.current = null;
      }
      socket.emit('leave-room');
      socket.disconnect();
    }

    navigate('/dashboard');
  }, [navigate, roomId, roomReady]);

  
  
  
  
  const [splitOn, setSplitOn] = useState(false);
  const [splitFileId, setSplitFileId] = useState(null);

  useEffect(() => {
    const toggle = () => {
      if (!splitOn && !splitFileId) {
        
        
        const recentOther = [...openTabs].reverse().find((id) => id !== activeFileId);
        const fallback = files.find((f) => f.id !== activeFileId)?.id || null;
        setSplitFileId(recentOther || fallback);
      }
      setSplitOn((v) => !v);
    };
    window.addEventListener('synapse:toggle-split', toggle);
    return () => window.removeEventListener('synapse:toggle-split', toggle);
  }, [openTabs, activeFileId, files, splitOn, splitFileId]);

  
  const splitSharedText = splitFileId && yjsManager ? yjsManager.getText(splitFileId) : null;

  
  const splitRemotePeers = useMemo(
    () =>
      Object.values(presence).filter(
        (peer) =>
          peer.userId !== user?.userId &&
          (peer.position?.fileId === splitFileId ||
            peer.selectionRange?.fileId === splitFileId)
      ),
    [splitFileId, presence, user?.userId]
  );

  const activeRemotePeers = useMemo(
    () =>
      Object.values(presence).filter(
        (peer) =>
          peer.userId !== user?.userId &&
          (peer.position?.fileId === activeFileId ||
            peer.selectionRange?.fileId === activeFileId)
      ),
    [activeFileId, presence, user?.userId]
  );
  const toolbarUser = useMemo(() => {
    const participant = user?.userId ? presence[user.userId] : null;
    return participant
      ? {
          ...user,
          username: participant.username,
          cursorColor: participant.cursorColor,
          avatarGlyph: participant.avatarGlyph,
        }
      : user;
  }, [presence, user]);

  const t = getThemeClasses(theme);

  if (loadingRoom) {
    return (
      <div className={`min-h-screen ${t.page} flex flex-col items-center justify-center gap-5 p-6`}>
        <div className={`w-12 h-12 rounded-lg border ${t.border} flex items-center justify-center`}>
          <Loader2 size={22} className={`animate-spin ${t.textMuted}`} />
        </div>
        <div className="text-center">
          <p className={`text-lg font-semibold tracking-tight ${t.textPrimary} mb-1.5`}>Connecting to room</p>
          <p className={`font-mono text-sm ${t.textMuted} tracking-[0.2em]`}>{roomId}</p>
          <p className={`text-xs ${t.textMuted2} mt-2.5`}>Syncing shared documents…</p>
        </div>
      </div>
    );
  }

  if (error && !roomReady) {
    return (
      <div className={`min-h-screen ${t.page} flex items-center justify-center p-6`}>
        <div className={`${t.modalCard} p-8 text-center`}>
          <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h1 className={`text-lg font-semibold tracking-tight ${t.textPrimary} mb-2`}>Unable to join room</h1>
          <p className={`text-sm ${t.textSecondary} leading-relaxed mb-6`}>{error}</p>
          <button className={`${t.btnPrimary} w-full`} onClick={() => navigate('/join-room')}>
            <ArrowLeft size={16} />
            Return to join room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${t.page} font-sans select-none overflow-hidden`} data-theme={theme}>
      <Toolbar
        theme={theme}
        onToggleTheme={toggleTheme}
        setOutput={setOutput}
        roomId={roomId}
        roomName={roomName}
        copied={copied}
        onCopyInvite={handleCopyInvite}
        onExitRoom={handleExitRoom}
        onSaveVersion={handleSaveVersion}
        currentUser={toolbarUser}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden p-2 gap-2 min-h-0">
        <SnippetHost theme={theme} />
        <ProjectTemplatesHost theme={theme} />
        <PracticeHost theme={theme} />
        <RenameSymbolHost />
        <DebugHost />
        <ExtensionsHost />
        <NotebookHost />
        <RestHost />
        <DbHost />
        <DeployHost />
        <DockerHost />
        <TasksHost />
        <PreviewHost />
        <TestHost />
        <TimelineHost />
        <ReadmeHost theme={theme} />
        <DiffHost theme={theme} />
        <MarkdownPreviewHost theme={theme} />
        <GitHubImportHost theme={theme} />
        <QuickOpenHost />

        {!zenMode && (
          <Sidebar
            theme={theme}
            collaborators={Object.values(presence)}
            chatMessages={chatMessages}
            typingUsers={Object.values(typingUsers)}
            getSocket={() => socketRef.current}
            roomId={roomId}
            currentUser={user}
            fileLocks={fileLocks}
          />
        )}

        <main className="flex-1 min-w-0 flex flex-col bg-[#121824] overflow-hidden rounded-xl border border-[#2b3546] min-h-0">
          {myRole === 'viewer' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/25 text-amber-500 shrink-0">
              <Eye size={13} className="shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]">View only</span>
              <span className="text-[11px] opacity-80 truncate">You can read, run and chat, but editing is disabled. Ask the host for editor access.</span>
            </div>
          )}
          <TabBar
            theme={theme}
            roomId={roomId}
            fileLocks={fileLocks}
            currentUserId={user?.userId}
            showSplit
            splitActive={splitOn}
          />
          <Breadcrumbs />

          { }
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 min-w-0 flex flex-col">
              <EditorPanel
                theme={theme}
                editorSettings={editorSettings}
                onCursorMove={handleCursorMove}
                onSelectionChange={handleSelectionChange}
                onLocalChange={handleLocalChange}
                sharedText={sharedText}
                remotePeers={activeRemotePeers}
                editingUsers={editingUsers}
                activeFileId={activeFileId}
                activeFileLock={activeFileLock}
                isReadOnly={false}
                forceReadOnly={myRole === 'viewer'}
                lockedByOther={isActiveFileLockedByOther}
                lockNotice={lockNotice}
              />
            </div>
            {splitOn && (
              <>
                <div className="w-px shrink-0 bg-white/8" />
                <div className="flex-1 min-w-0 flex flex-col">
                  { }
                  <div className="h-[30px] flex items-center gap-2 px-2 bg-[#0D1220] border-b border-white/[0.06] shrink-0">
                    <select
                      value={splitFileId || ''}
                      onChange={(e) => setSplitFileId(e.target.value || null)}
                      className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-[#C9D4E6] outline-none cursor-pointer"
                      aria-label="Split pane file"
                    >
                      {openTabs.map((id) => {
                        const f = files.find((x) => x.id === id);
                        if (!f) return null;
                        return (
                          <option key={id} value={id} className="bg-[#0D1220]">
                            {f.name}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      onClick={() => setSplitOn(false)}
                      className="p-1 rounded text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/10 transition-colors cursor-pointer"
                      title="Close split"
                      aria-label="Close split editor"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <EditorPanel
                    theme={theme}
                    editorSettings={editorSettings}
                    fileIdOverride={splitFileId}
                    isPrimary={false}
                    sharedText={splitSharedText}
                    remotePeers={splitRemotePeers}
                    editingUsers={editingUsers}
                    activeFileId={splitFileId}
                    onLocalChange={handleLocalChange}
                    isReadOnly={false}
                    forceReadOnly={myRole === 'viewer'}
                  />
                </div>
              </>
            )}
          </div>

          <OutputPanel theme={theme} output={output} roomId={roomId} myRole={myRole} />
        </main>

        {!zenMode && <NeuraPanel theme={theme} />}
      </div>

      {!zenMode && (
        <StatusBar contextLabel={`Room ${roomId}`} />
      )}

      { }
      {!zenMode && !voiceOpen && (
        <button
          onClick={() => setVoiceOpen(true)}
          aria-label="Join voice chat"
          title="Join voice chat"
          className="fixed bottom-16 right-3 z-40 w-11 h-11 rounded-xl bg-[#d9ff3f] text-[#10140b] flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all"
        >
          <Phone size={18} />
        </button>
      )}
      {voiceOpen && (
        <div className="fixed inset-0 z-[70] md:inset-auto md:right-2 md:top-16 md:bottom-2 md:w-[380px] md:rounded-xl md:overflow-hidden md:border md:border-[#283348] md:shadow-[0_18px_54px_rgba(0,0,0,0.5)]">
          <div
            className="absolute inset-0 bg-black/60 md:hidden"
            onClick={() => setVoiceOpen(false)}
          />
          <div className="absolute inset-0 md:relative md:h-full syn-drawer-fade">
            <VoiceChat
              roomId={roomId}
              theme={theme}
              onClose={() => setVoiceOpen(false)}
            />
          </div>
        </div>
      )}

      { }
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExit={handleExitRoom}
        settings={editorSettings}
        onIncreaseFont={increaseFont}
        onDecreaseFont={decreaseFont}
        onToggleWordWrap={toggleWordWrap}
        onToggleMinimap={toggleMinimap}
        onCycleFontFamily={cycleFontFamily}
        onCycleTabSize={cycleTabSize}
        onToggleFormatOnType={toggleFormatOnType}
        onToggleStickyScroll={toggleStickyScroll}
        onOpenReview={() => setReviewOpen(true)}
      />

      { }
      <CodeReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        theme={theme}
      />
    </div>
  );
}

export default function RoomPage() {
  const { roomId } = useParams();

  return (
    <FileProvider storageKey={null}>
      <RoomSession roomId={String(roomId || '').toUpperCase()} />
    </FileProvider>
  );
}
