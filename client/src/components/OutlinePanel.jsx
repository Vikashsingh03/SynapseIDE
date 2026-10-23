import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Braces,
  Cog,
  Layers,
  ListTree,
  Search,
  Shapes,
  SquareFunction,
  Variable,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { extractSymbols } from '../utils/outline';

const KIND_META = {
  function: { Icon: SquareFunction, color: '#C792EA', label: 'Function' },
  class: { Icon: Box, color: '#FFCB6B', label: 'Class' },
  method: { Icon: Cog, color: '#82AAFF', label: 'Method' },
  variable: { Icon: Variable, color: '#58A6FF', label: 'Variable' },
  interface: { Icon: Braces, color: '#2DD4BF', label: 'Interface' },
  type: { Icon: Shapes, color: '#F78C6C', label: 'Type' },
  enum: { Icon: Layers, color: '#B8CC52', label: 'Enum' },
};

export default function OutlinePanel() {
  const { activeFile, activeFileId, openTabs, openTab, jumpToFileLine } = useFiles();
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setFilter('');
  }, [activeFileId]);

  const symbols = useMemo(() => {
    if (!activeFile || activeFile.type === 'folder') return [];
    return extractSymbols(activeFile.content || '', activeFile.name || '');
  }, [activeFile]);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return symbols;
    return symbols.filter((s) => s.name.toLowerCase().includes(query));
  }, [symbols, filter]);

  const handleJump = (line) => {
    if (!activeFileId) return;
    if (Array.isArray(openTabs) && !openTabs.includes(activeFileId)) {
      openTab(activeFileId);
    }
    jumpToFileLine(activeFileId, line);
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0B0F16] text-[#C7D3E8]">
      <div className="h-[34px] flex items-center justify-between gap-2 px-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#EAF1FB]">
            Outline
          </span>
          {symbols.length > 0 && (
            <span className="text-[10.5px] font-semibold text-[#9AA9C2] bg-white/[0.05] rounded-full px-1.5 py-0.5 tabular-nums">
              {symbols.length}
            </span>
          )}
        </div>
        {activeFile && (
          <span className="text-[10.5px] text-[#5C6B82] truncate">{activeFile.name}</span>
        )}
      </div>
      <div className="px-3.5 py-2 border-b border-white/[0.04] shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5C6B82] pointer-events-none"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter symbols…"
            spellCheck={false}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-md text-[12px] text-[#EAF1FB] placeholder:text-[#5C6B82] pl-7 pr-2 py-1.5 outline-none focus:border-[#D9FF3F]/40 transition-colors"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {!activeFile || activeFile.type === 'folder' ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <ListTree size={26} className="text-[#3F4C63]" />
            <p className="text-[12.5px] font-semibold text-[#9AA9C2]">No active file</p>
            <p className="text-[11px] text-[#5C6B82]">
              Open a file to see its functions, classes and other symbols.
            </p>
          </div>
        ) : symbols.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <ListTree size={26} className="text-[#3F4C63]" />
            <p className="text-[12.5px] font-semibold text-[#9AA9C2]">No symbols found</p>
            <p className="text-[11px] text-[#5C6B82]">
              Functions, classes and other symbols in {activeFile.name} will appear here.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <Search size={26} className="text-[#3F4C63]" />
            <p className="text-[12.5px] font-semibold text-[#9AA9C2]">No matching symbols</p>
            <p className="text-[11px] text-[#5C6B82]">No symbol name contains “{filter.trim()}”.</p>
          </div>
        ) : (
          visible.map((s, i) => {
            const meta = KIND_META[s.kind] || KIND_META.variable;
            const Icon = meta.Icon;
            return (
              <button
                key={`${s.name}-${s.line}-${i}`}
                onClick={() => handleJump(s.line)}
                title={`${meta.label} — line ${s.line}`}
                className="w-full flex items-center gap-2 pr-3.5 py-[5px] hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
                style={{ paddingLeft: `${14 + s.depth * 14}px` }}
              >
                <Icon size={13} style={{ color: meta.color }} className="shrink-0" />
                <span className="flex-1 min-w-0 truncate text-[12px] text-[#C7D3E8]">{s.name}</span>
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-[#5C6B82] shrink-0">
                  {meta.label}
                </span>
                <span className="text-[10.5px] text-[#5C6B82] font-mono tabular-nums shrink-0">
                  Ln {s.line}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
