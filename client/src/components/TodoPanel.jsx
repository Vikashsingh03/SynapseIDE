import { useMemo, useState } from 'react';
import { ListTodo, Search, CheckCircle2 } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import FileIcon from './FileIcon';
import { scanTodos, TODO_TAGS } from '../utils/todoScan';

const TAG_CHIP_CLASSES = {
  TODO: 'text-[#58A6FF] border-[#58A6FF]/30 bg-[#58A6FF]/10',
  FIXME: 'text-[#FB923C] border-[#FB923C]/30 bg-[#FB923C]/10',
  HACK: 'text-[#FBBF24] border-[#FBBF24]/30 bg-[#FBBF24]/10',
  BUG: 'text-[#F87171] border-[#F87171]/30 bg-[#F87171]/10',
  NOTE: 'text-[#4ADE80] border-[#4ADE80]/30 bg-[#4ADE80]/10',
  XXX: 'text-[#C084FC] border-[#C084FC]/30 bg-[#C084FC]/10',
};

export default function TodoPanel() {
  const { files, openTab, jumpToFileLine } = useFiles();
  const [query, setQuery] = useState('');

  const results = useMemo(() => scanTodos(files), [files]);

  const tagCounts = useMemo(() => {
    const counts = new Map();
    for (const item of results) {
      counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
    }
    return counts;
  }, [results]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    return results.filter(
      (item) =>
        item.text.toLowerCase().includes(q) || String(item.fileName ?? '').toLowerCase().includes(q)
    );
  }, [results, query]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of filtered) {
      if (!groups.has(item.fileId)) {
        groups.set(item.fileId, { fileName: item.fileName, items: [] });
      }
      groups.get(item.fileId).items.push(item);
    }
    return [...groups.entries()];
  }, [filtered]);

  const handleRowClick = (item) => {
    openTab(item.fileId);
    jumpToFileLine(item.fileId, item.line);
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0B0F16] text-[#C7D3E8]">
      <div className="h-[34px] flex items-center justify-between px-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo size={13} className="text-[#A9B7CC]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#EAF1FB]">
            Todos
          </span>
          {results.length > 0 && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#D9FF3F] bg-[#D9FF3F]/10 rounded-full px-1.5 py-0.5 tabular-nums">
              {results.length}
            </span>
          )}
        </div>
      </div>

      <div className="px-3.5 py-2 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5">
          <Search size={12} className="text-[#5C6B82] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by text or file name"
            className="w-full bg-transparent text-[11.5px] text-[#EAF1FB] placeholder:text-[#5C6B82] outline-none"
          />
        </div>
        {results.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {TODO_TAGS.filter((tag) => tagCounts.has(tag)).map((tag) => (
              <span
                key={tag}
                className={`text-[9.5px] font-semibold uppercase tracking-wide border rounded px-1 py-px tabular-nums ${TAG_CHIP_CLASSES[tag]}`}
              >
                {tag} {tagCounts.get(tag)}
              </span>
            ))}
            {results.length >= 500 && (
              <span className="text-[10px] text-[#5C6B82]">Results capped at 500</span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <CheckCircle2 size={26} className="text-[#3F5A43]" />
            <p className="text-[12.5px] font-semibold text-[#9AA9C2]">No TODOs — clean workspace</p>
            <p className="text-[11px] text-[#5C6B82]">
              TODO, FIXME, HACK, BUG, NOTE and XXX tags across your files will show up here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <Search size={24} className="text-[#3D4A61]" />
            <p className="text-[12.5px] font-semibold text-[#9AA9C2]">No matches</p>
            <p className="text-[11px] text-[#5C6B82] break-words">
              Nothing matches “{query.trim()}” in text or file names.
            </p>
          </div>
        ) : (
          grouped.map(([fileId, group]) => (
            <div key={fileId} className="border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.02]">
                <FileIcon name={group.fileName} size={12} />
                <span className="text-[11px] font-semibold text-[#9AA9C2] truncate">{group.fileName}</span>
                <span className="ml-auto text-[10px] font-semibold text-[#5C6B82] tabular-nums shrink-0">
                  {group.items.length}
                </span>
              </div>
              {group.items.map((item, i) => (
                <button
                  key={`${item.fileId}-${item.line}-${item.tag}-${i}`}
                  onClick={() => handleRowClick(item)}
                  className="w-full text-left flex items-center gap-2 px-3.5 py-[7px] hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <span
                    className={`text-[9.5px] font-semibold uppercase tracking-wide border rounded px-1 py-px shrink-0 ${TAG_CHIP_CLASSES[item.tag]}`}
                  >
                    {item.tag}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] leading-snug text-[#C7D3E8]">
                    {item.text || '—'}
                  </span>
                  <span className="text-[10.5px] text-[#5C6B82] font-mono tabular-nums whitespace-nowrap shrink-0">
                    Ln {item.line}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
