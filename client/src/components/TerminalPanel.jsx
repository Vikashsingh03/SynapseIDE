import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Trash2,
  Copy,
  ClipboardPaste,
  ZoomIn,
  ZoomOut,
  Eraser,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { createCollaborationSocket } from '../services/socket';
import { useFiles } from '../contexts/FileContext';

const XTERM_THEME = {
  background: '#0d1420',
  foreground: '#dce5f3',
  cursor: '#d9ff3f',
  cursorAccent: '#0d1420',
  selectionBackground: 'rgba(21, 87, 255, 0.35)',
  black: '#0d1420',
  red: '#ff4d35',
  green: '#7ddf64',
  yellow: '#ffd23f',
  blue: '#1557ff',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#dce5f3',
  brightBlack: '#4a5568',
  brightRed: '#ff6b57',
  brightGreen: '#9bef7f',
  brightYellow: '#ffe066',
  brightBlue: '#4d7fff',
  brightMagenta: '#d896ee',
  brightCyan: '#7cc7d1',
  brightWhite: '#ffffff',
};

/**
 * VS Code-style terminal panel: multiple tabs, right-click paste,
 * font zoom, clear, per-tab kill. Real shell via node-pty on the server.
 */
export default function TerminalPanel({ roomId } = {}) {
  // Solo editor: grab local files so the terminal gets a real workspace
  let localFiles = [];
  try {
    const ctx = useFiles();
    localFiles = (ctx?.files || []).map((f) => ({ name: f.name, content: f.content ?? '' }));
  } catch {}
  const localFilesRef = useRef(localFiles);
  localFilesRef.current = localFiles;
  const socketRef = useRef(null);
  const termsRef = useRef(new Map()); // terminalId -> { term, fit, container, disposeData }
  const [tabs, setTabs] = useState([]); // [{ id, label, status }]
  const [activeId, setActiveId] = useState(null);
  const [fontSize, setFontSize] = useState(13);
  const [globalError, setGlobalError] = useState('');
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

  const fitActive = useCallback(() => {
    const entry = termsRef.current.get(activeIdRef.current);
    if (!entry) return;
    try {
      entry.fit.fit();
      const { cols, rows } = entry.fit.proposeDimensions() || {};
      if (cols && rows) {
        socketRef.current?.emit('terminal:resize', {
          terminalId: activeIdRef.current,
          cols,
          rows,
        });
      }
    } catch {}
  }, []);

  const createTerminal = useCallback(() => {
    setGlobalError('');
    socketRef.current?.emit('terminal:create', { roomId, files: roomId ? undefined : localFilesRef.current });
  }, [roomId]);

  // Mount an xterm instance for a new terminalId
  const mountTerminal = useCallback(
    (terminalId, label, container) => {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily: "'IBM Plex Mono', 'Cascadia Code', Consolas, monospace",
        fontSize,
        lineHeight: 1.25,
        scrollback: 5000,
        theme: XTERM_THEME,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      requestAnimationFrame(() => {
        try {
          fit.fit();
        } catch {}
      });

      term.writeln('\x1b[1;32m◈ Synapse Terminal\x1b[0m \x1b[2m— starting shell…\x1b[0m');

      // Input -> server
      const disposeData = term.onData((data) =>
        socketRef.current?.emit('terminal:input', { terminalId, data })
      );

      // Right-click = paste (VS Code style)
      const handleContextMenu = async (e) => {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          if (text) socketRef.current?.emit('terminal:input', { terminalId, data: text });
        } catch {}
      };
      container.addEventListener('contextmenu', handleContextMenu);

      // Ctrl+C copy when there's a selection, else send SIGINT
      term.attachCustomKeyEventHandler((e) => {
        if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
          const sel = term.getSelection();
          navigator.clipboard.writeText(sel).catch(() => {});
          term.clearSelection();
          return false; // don't send to pty
        }
        if (e.ctrlKey && e.key === 'v') {
          navigator.clipboard.readText().then((text) => {
            if (text) socketRef.current?.emit('terminal:input', { terminalId, data: text });
          }).catch(() => {});
          return false;
        }
        return true;
      });

      termsRef.current.set(terminalId, {
        term,
        fit,
        container,
        dispose: () => {
          disposeData.dispose();
          container.removeEventListener('contextmenu', handleContextMenu);
          term.dispose();
        },
      });

      // Resize to fit now that it's visible
      setTimeout(() => {
        if (activeIdRef.current === terminalId) fitActive();
      }, 50);
    },
    [fitActive, fontSize]
  );

  const killTerminal = useCallback((terminalId) => {
    socketRef.current?.emit('terminal:kill', { terminalId });
    const entry = termsRef.current.get(terminalId);
    if (entry) {
      entry.dispose();
      termsRef.current.delete(terminalId);
    }
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== terminalId);
      if (activeIdRef.current === terminalId) {
        setActiveId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, []);

  const clearActive = useCallback(() => {
    termsRef.current.get(activeIdRef.current)?.term.clear();
  }, []);

  const changeFont = useCallback((delta) => {
    setFontSize((prev) => {
      const next = Math.min(20, Math.max(9, prev + delta));
      for (const entry of termsRef.current.values()) {
        entry.term.options.fontSize = next;
      }
      setTimeout(() => fitActive(), 50);
      return next;
    });
  }, [fitActive]);

  // ─── Socket lifecycle ───
  useEffect(() => {
    const socket = createCollaborationSocket();
    socketRef.current = socket;

    socket.on('terminal:ready', ({ terminalId, label }) => {
      setTabs((prev) => {
        if (prev.some((t) => t.id === terminalId)) return prev;
        const tab = {
          id: terminalId,
          label: `${label || 'shell'}${prev.length > 0 ? ` ${prev.length + 1}` : ''}`,
          status: 'ready',
        };
        return [...prev, tab];
      });
      setActiveId(terminalId);
    });

    socket.on('terminal:output', ({ terminalId, data }) => {
      termsRef.current.get(String(terminalId))?.term.write(data);
    });

    socket.on('terminal:exit', ({ terminalId, exitCode }) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === String(terminalId) ? { ...t, status: 'exited' } : t))
      );
      termsRef.current
        .get(String(terminalId))
        ?.term.writeln(`\r\n\x1b[2m— exited (code ${exitCode}).\x1b[0m`);
    });

    socket.on('terminal:killed', ({ terminalId }) => {
      setTabs((prev) => prev.map((t) => (t.id === String(terminalId) ? { ...t, status: 'exited' } : t)));
    });

    socket.on('terminal:error', ({ message }) => {
      setGlobalError(message || 'Could not start terminal.');
    });

    socket.connect();
    // Auto-create the first terminal
    socket.emit('terminal:create', { roomId, files: roomId ? undefined : localFilesRef.current });

    const onResize = () => fitActive();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      for (const entry of termsRef.current.values()) entry.dispose();
      termsRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fitActive]);

  // Fit when switching tabs
  useEffect(() => {
    if (activeId) setTimeout(() => fitActive(), 60);
  }, [activeId, fitActive]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0d1420]">
      {/* VS Code-style tab bar */}
      <div className="flex items-center border-b border-[#1c2942] shrink-0 bg-[#0a101c]">
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto custom-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 font-mono text-[11px] cursor-pointer border-r border-[#1c2942] whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#0d1420] text-[#dce5f3] border-t-2 border-t-[#d9ff3f]'
                    : 'text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/3'
                }`}
              >
                <TerminalIcon size={11} className={isActive ? 'text-[#d9ff3f]' : ''} />
                <span>{tab.label}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    tab.status === 'ready' ? 'bg-emerald-400' : 'bg-[#4a5568]'
                  }`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    killTerminal(tab.id);
                  }}
                  title="Kill terminal"
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-[#ff4d35] transition-all"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
          <button
            onClick={createTerminal}
            title="New terminal (Ctrl+Shift+`)"
            className="p-1.5 mx-1 rounded-md text-[#8290a8] hover:text-[#d9ff3f] hover:bg-white/5 transition-colors shrink-0"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-0.5 px-2 shrink-0 border-l border-[#1c2942]">
          <button onClick={clearActive} title="Clear terminal" className="p-1.5 rounded-md text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/5 transition-colors">
            <Eraser size={12} />
          </button>
          <button onClick={() => changeFont(-1)} title="Decrease font size" className="p-1.5 rounded-md text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/5 transition-colors">
            <ZoomOut size={12} />
          </button>
          <button onClick={() => changeFont(1)} title="Increase font size" className="p-1.5 rounded-md text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/5 transition-colors">
            <ZoomIn size={12} />
          </button>
          <button
            onClick={() => activeId && killTerminal(activeId)}
            title="Kill active terminal"
            className="p-1.5 rounded-md text-[#8290a8] hover:text-[#ff4d35] hover:bg-white/5 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal views */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => {
              if (el && !termsRef.current.has(tab.id)) {
                mountTerminal(tab.id, tab.label, el);
              }
            }}
            className={`absolute inset-0 px-2 py-1 [&_.xterm]:h-full ${
              tab.id === activeId ? 'visible' : 'invisible'
            }`}
          />
        ))}
        {tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#8290a8]">
            <TerminalIcon size={28} />
            <p className="font-mono text-xs">No terminal open</p>
            <button
              onClick={createTerminal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#d9ff3f] text-black font-mono text-xs font-bold hover:brightness-110 transition-all"
            >
              <Plus size={13} /> New Terminal
            </button>
          </div>
        )}
      </div>

      {globalError && (
        <div className="px-3 py-2 border-t border-[#1c2942] font-mono text-[11px] text-[#ff6b57] shrink-0">
          {globalError}
        </div>
      )}

      {/* Hint bar */}
      <div className="px-3 py-1 border-t border-[#1c2942] font-mono text-[10px] text-[#4a5568] shrink-0 flex items-center gap-3">
        <span className="flex items-center gap-1"><Copy size={9} /> select + Ctrl+C = copy</span>
        <span className="flex items-center gap-1"><ClipboardPaste size={9} /> right-click = paste</span>
      </div>
    </div>
  );
}
