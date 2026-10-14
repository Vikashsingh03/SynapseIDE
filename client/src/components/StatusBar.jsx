import { useEffect, useState } from 'react';
import { GitBranch, Check } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import FileIcon from './FileIcon';

/**
 * StatusBar — VS Code-style bottom status bar, premium edition.
 *
 * - LEFT:  a filled accent segment (room/Synapse identity) + active file
 *           with its real Material Icon Theme icon + language label.
 * - RIGHT: cursor position (Ln/Col + selected count) from the
 *           `synapse:cursor` window event, language label, `UTF-8`, and a
 *           `Ready` indicator.
 *
 * Fully self-contained: it pulls the active file from FileContext and the
 * cursor from a window CustomEvent — the parent only passes contextLabel.
 */

const EXT_LANGUAGE = {
  js: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  jsx: 'JavaScript React',
  ts: 'TypeScript',
  mts: 'TypeScript',
  tsx: 'TypeScript React',
  py: 'Python',
  cpp: 'C++',
  cxx: 'C++',
  cc: 'C++',
  c: 'C',
  h: 'C',
  hpp: 'C++',
  java: 'Java',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  json: 'JSON',
  md: 'Markdown',
  txt: 'Plain Text',
  yml: 'YAML',
  yaml: 'YAML',
  xml: 'XML',
  svg: 'SVG',
  sh: 'Shell',
  rs: 'Rust',
  go: 'Go',
  rb: 'Ruby',
  php: 'PHP',
  kt: 'Kotlin',
  swift: 'Swift',
  sql: 'SQL',
  dart: 'Dart',
  r: 'R',
  toml: 'TOML',
  ini: 'INI',
  vue: 'Vue',
  svelte: 'Svelte',
  dockerfile: 'Docker',
};

function languageLabel(fileName) {
  if (!fileName) return '';
  const base = fileName.split('/').pop();
  const dot = base.lastIndexOf('.');
  if (dot <= 0) {
    // dotfiles / extensionless — special names
    const lower = base.toLowerCase();
    if (lower.startsWith('dockerfile')) return 'Docker';
    if (lower === 'makefile') return 'Makefile';
    return 'Plain Text';
  }
  const ext = base.slice(dot + 1).toLowerCase();
  if (EXT_LANGUAGE[ext]) return EXT_LANGUAGE[ext];
  return ext.toUpperCase();
}

export default function StatusBar({ contextLabel }) {
  const { files, activeFileId } = useFiles();
  const activeFile = files.find((f) => f.id === activeFileId && f.type === 'file') || null;

  const [cursor, setCursor] = useState(null); // { line, column, selectedChars }

  useEffect(() => {
    const handler = (e) => {
      const d = e?.detail || {};
      if (typeof d.line === 'number' && typeof d.column === 'number') {
        setCursor({
          line: d.line,
          column: d.column,
          selectedChars: typeof d.selectedChars === 'number' ? d.selectedChars : 0,
        });
      }
    };
    window.addEventListener('synapse:cursor', handler);
    return () => window.removeEventListener('synapse:cursor', handler);
  }, []);

  const lang = activeFile ? languageLabel(activeFile.name) : '';

  return (
    <footer
      className="h-[26px] flex items-stretch justify-between text-[11.5px] select-none shrink-0 bg-[#0B0F16]/95 backdrop-blur border-t border-white/10 text-[#A9B7CC] overflow-hidden"
      role="statusbar"
      aria-label="Status bar"
    >
      {/* ─── LEFT ─── */}
      <div className="flex items-stretch min-w-0">
        <div
          className="flex items-center gap-1.5 px-2.5 font-semibold text-white text-[11px] tracking-wide whitespace-nowrap"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #58a6ff 100%)',
            boxShadow: '0 0 14px rgba(88, 166, 255, 0.45)',
          }}
        >
          <GitBranch size={12} strokeWidth={2.5} />
          <span>{contextLabel || 'Synapse'}</span>
        </div>

        {activeFile ? (
          <>
            <span className="flex items-center gap-1.5 px-2.5 min-w-0 hover:bg-white/5 transition-colors cursor-default">
              <FileIcon name={activeFile.name} size={12} />
              <span className="truncate text-[#D6DFEC]">{activeFile.name}</span>
            </span>
            <span className="flex items-center px-2 hover:bg-white/5 transition-colors cursor-default whitespace-nowrap">
              {lang}
            </span>
          </>
        ) : (
          <span className="flex items-center px-2.5 text-[#5C6B82] whitespace-nowrap">
            No file open
          </span>
        )}
      </div>

      {/* ─── RIGHT ─── */}
      <div className="flex items-stretch">
        {cursor && (
          <span className="flex items-center px-2.5 hover:bg-white/5 transition-colors cursor-default whitespace-nowrap tabular-nums">
            Ln {cursor.line}, Col {cursor.column}
            {cursor.selectedChars > 0 && (
              <span className="text-[#7C8CA6]"> ({cursor.selectedChars} selected)</span>
            )}
          </span>
        )}
        {lang && (
          <span className="flex items-center px-2.5 hover:bg-white/5 transition-colors cursor-default whitespace-nowrap">
            {lang}
          </span>
        )}
        <span className="flex items-center px-2.5 hover:bg-white/5 transition-colors cursor-default whitespace-nowrap">
          UTF-8
        </span>
        <span className="flex items-center gap-1 px-2.5 hover:bg-white/5 transition-colors cursor-default whitespace-nowrap text-[#7ED492]">
          <Check size={12} strokeWidth={2.5} />
          <span className="text-[#A9B7CC]">Ready</span>
        </span>
      </div>
    </footer>
  );
}
