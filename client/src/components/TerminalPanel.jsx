import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { createCollaborationSocket } from '../services/socket';

/**
 * In-browser terminal — a real shell (PowerShell / bash) running on the
 * server, rendered with xterm.js. Spicy Synapse dark theme included.
 */
export default function TerminalPanel() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const socketRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting | ready | error | exited
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const socket = createCollaborationSocket();
    socketRef.current = socket;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: "'IBM Plex Mono', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 2000,
      theme: {
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
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    term.open(containerRef.current);
    // Fit after paint so the container has real dimensions
    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {}
    });

    term.writeln('\x1b[1;32m◈ Synapse Terminal\x1b[0m \x1b[2m— starting shell…\x1b[0m');

    const onData = (data) => socket.emit('terminal:input', data);
    const disposeData = term.onData(onData);

    socket.on('terminal:output', (data) => term.write(data));
    socket.on('terminal:ready', () => {
      setStatus('ready');
      const { cols, rows } = fit.proposeDimensions() || { cols: 80, rows: 24 };
      socket.emit('terminal:resize', { cols, rows });
    });
    socket.on('terminal:error', ({ message }) => {
      setStatus('error');
      setErrorMsg(message || 'Could not start terminal.');
      term.writeln(`\r\n\x1b[1;31m✖ ${message || 'Could not start terminal.'}\x1b[0m`);
    });
    socket.on('terminal:exit', ({ exitCode }) => {
      setStatus('exited');
      term.writeln(`\r\n\x1b[2m— shell exited (code ${exitCode}). Hit + for a new one.\x1b[0m`);
    });

    socket.connect();
    socket.emit('terminal:create');

    const onResize = () => {
      try {
        fit.fit();
        const { cols, rows } = fit.proposeDimensions() || {};
        if (cols && rows) socket.emit('terminal:resize', { cols, rows });
      } catch {}
    };
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      disposeData.dispose();
      socket.emit('terminal:kill');
      socket.disconnect();
      term.dispose();
      termRef.current = null;
      socketRef.current = null;
    };
  }, []);

  const handleNew = () => {
    const term = termRef.current;
    const socket = socketRef.current;
    if (!term || !socket) return;
    term.clear();
    setStatus('connecting');
    setErrorMsg('');
    term.writeln('\x1b[1;32m◈ Synapse Terminal\x1b[0m \x1b[2m— starting shell…\x1b[0m');
    socket.emit('terminal:create');
  };

  const handleKill = () => {
    socketRef.current?.emit('terminal:kill');
    setStatus('exited');
    termRef.current?.writeln('\r\n\x1b[2m— session killed. Hit + for a new one.\x1b[0m');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0d1420]">
      {/* Terminal toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1c2942] shrink-0">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#8290a8]">
          <TerminalIcon size={12} className="text-[#d9ff3f]" />
          shell
          {status === 'connecting' && (
            <Loader2 size={11} className="animate-spin text-[#d9ff3f]" />
          )}
          {status === 'ready' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
          {status === 'error' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d35]" />
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNew}
            title="New terminal session"
            className="p-1.5 rounded-md text-[#8290a8] hover:text-[#d9ff3f] hover:bg-white/5 transition-colors"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={handleKill}
            title="Kill terminal session"
            className="p-1.5 rounded-md text-[#8290a8] hover:text-[#ff4d35] hover:bg-white/5 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* xterm mount */}
      <div ref={containerRef} className="flex-1 min-h-0 px-2 py-1 [&_.xterm]:h-full" />

      {status === 'error' && errorMsg && (
        <div className="px-3 py-2 border-t border-[#1c2942] font-mono text-[11px] text-[#ff6b57] shrink-0">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
