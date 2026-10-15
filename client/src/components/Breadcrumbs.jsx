import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Dot, Braces } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import FileIcon from './FileIcon';















export default function Breadcrumbs({ className = '' }) {
  const { files, activeFile } = useFiles();
  const [cursorLine, setCursorLine] = useState(null);

  
  useEffect(() => {
    const onCursor = (e) => {
      const line = e?.detail?.line;
      if (typeof line === 'number') setCursorLine(line);
    };
    window.addEventListener('synapse:cursor', onCursor);
    return () => window.removeEventListener('synapse:cursor', onCursor);
  }, []);

  const idToFile = useMemo(() => {
    const m = new Map();
    (files || []).forEach((f) => m.set(f.id, f));
    return m;
  }, [files]);

  
  const trail = useMemo(() => {
    if (!activeFile) return [];
    const segs = [];
    const seen = new Set();
    let node = activeFile;
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      segs.push(node);
      node = node.parentId != null ? idToFile.get(node.parentId) : null;
    }
    return segs.reverse();
  }, [activeFile, idToFile]);

  
  const symbols = useMemo(() => {
    if (!activeFile || typeof activeFile.content !== 'string') return [];
    const name = (activeFile.name || '').toLowerCase();
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
    const lines = activeFile.content.split('\n');
    const out = [];
    const push = (symName, i, kind) => {
      if (out.length >= 30) return;
      out.push({ name: symName, line: i + 1, kind });
    };

    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
      const pats = [
        [/^\s*(?:export\s+default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, 'function'],
        [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/, 'function'],
        [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)\([^)]*\)\s*=>/, 'function'],
        [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>/, 'function'],
        [/^\s*(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
      ];
      lines.forEach((ln, i) => {
        for (const [re, kind] of pats) {
          const m = re.exec(ln);
          if (m) {
            push(m[1], i, kind);
            break;
          }
        }
      });
    } else if (ext === 'py') {
      const pats = [
        [/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/, 'function'],
        [/^\s*class\s+([A-Za-z_]\w*)/, 'class'],
      ];
      lines.forEach((ln, i) => {
        for (const [re, kind] of pats) {
          const m = re.exec(ln);
          if (m) {
            push(m[1], i, kind);
            break;
          }
        }
      });
    } else if (['java', 'cpp', 'c', 'cc', 'cxx', 'h', 'hpp', 'cs'].includes(ext)) {
      const classRe = /^\s*(?:public\s+|private\s+|protected\s+|static\s+|final\s+|abstract\s+)*class\s+([A-Za-z_]\w*)/;
      const methodRe = /^\s{0,8}(?:(?:public|private|protected|static|final|virtual|inline|constexpr|override)\s+)*(?:[\w:<>\[\],*&~]+\s+)+([A-Za-z_]\w*)\s*\(/;
      const controlFlow = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'sizeof', 'new', 'delete', 'using', 'typedef']);
      lines.forEach((ln, i) => {
        const cm = classRe.exec(ln);
        if (cm) {
          push(cm[1], i, 'class');
          return;
        }
        const mm = methodRe.exec(ln);
        if (mm && !controlFlow.has(mm[1])) push(mm[1], i, 'function');
      });
    }
    return out;
  }, [activeFile]);

  
  const currentSymbolIdx = useMemo(() => {
    if (cursorLine == null) return -1;
    let idx = -1;
    symbols.forEach((s, i) => {
      if (s.line <= cursorLine) idx = i;
    });
    return idx;
  }, [symbols, cursorLine]);

  if (!activeFile) return null;

  const folderSegs = trail.filter((s) => s.id !== activeFile.id);
  const fileSeg = activeFile;

  const revealFolder = (id) => {
    window.dispatchEvent(new CustomEvent('synapse:reveal-file', { detail: { id } }));
  };
  const gotoLine = (line) => {
    window.dispatchEvent(new CustomEvent('synapse:goto-line', { detail: { line } }));
  };

  return (
    <div
      className={`h-[30px] flex items-center gap-0.5 px-3 bg-[#0D1220] border-b border-white/[0.06] overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      aria-label="Breadcrumbs"
    >
      {folderSegs.map((seg) => (
        <span key={seg.id} className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => revealFolder(seg.id)}
            className="text-[12px] text-[#8B98AC] hover:text-[#E6EEF9] hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
            title={seg.name}
          >
            {seg.name}
          </button>
          <ChevronRight size={12} className="text-[#55617A]" />
        </span>
      ))}

      <span className="flex items-center gap-1.5 shrink-0">
        <FileIcon name={fileSeg.name || ''} size={13} />
        <span className="text-[12px] text-[#D7E2F2] font-medium">{fileSeg.name}</span>
      </span>

      {symbols.length > 0 && (
        <span className="flex items-center gap-0.5 shrink-0">
          <Dot size={14} className="text-[#55617A]" />
          <Braces size={12} className="text-[#55617A]" />
          {symbols.map((s, i) => {
            const active = i === currentSymbolIdx;
            return (
              <button
                key={`${s.name}-${s.line}-${i}`}
                onClick={() => gotoLine(s.line)}
                title={`${s.kind === 'class' ? 'Class' : 'Function'} · line ${s.line}`}
                className={`text-[12px] rounded px-1 py-0.5 transition-colors ${
                  active
                    ? 'text-[#58A6FF] font-medium'
                    : 'text-[#8B98AC] hover:text-[#E6EEF9] hover:bg-white/5'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </span>
      )}
    </div>
  );
}
