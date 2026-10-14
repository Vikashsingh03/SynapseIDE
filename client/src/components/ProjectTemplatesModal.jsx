import { useEffect, useMemo, useState } from 'react';
import {
  Atom, Component, Rocket, Globe, Server, FileCode, Cpu, Smartphone,
  Palette, LayoutGrid, X, FolderPlus,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { PROJECT_TEMPLATES } from '../templates/projects';

const TEMPLATE_ICONS = {
  Atom, Component, Rocket, Globe, Server, FileCode, Cpu, Smartphone,
  Palette, LayoutGrid, FolderPlus,
};

function sanitizeName(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'my-project';
}

function makeUniqueName(files, base) {
  let name = base;
  let n = 2;
  const exists = (candidate) =>
    files.some((f) => f.type === 'folder' && f.parentId === null && f.name.toLowerCase() === candidate.toLowerCase());
  while (exists(name)) {
    name = `${base}-${n}`;
    n += 1;
  }
  return name;
}

// Returns the id of the file created last from `mainFile` (or the first file).
function createProjectFromTemplate(template, projectName, ctx) {
  const { files, createFile, createFolder, updateContent, openTab } = ctx;
  const rootId = createFolder(makeUniqueName(files, projectName), null);
  if (!rootId) return;

  const folderCache = new Map(); // 'src/utils' -> folderId
  const ensureFolder = (relPath) => {
    if (!relPath) return rootId;
    if (folderCache.has(relPath)) return folderCache.get(relPath);
    const segments = relPath.split('/');
    let parentId = rootId;
    let acc = '';
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (folderCache.has(acc)) {
        parentId = folderCache.get(acc);
        continue;
      }
      const id = createFolder(seg, parentId);
      if (!id) break;
      folderCache.set(acc, id);
      parentId = id;
    }
    return parentId;
  };

  let mainFileId = null;
  let firstFileId = null;
  for (const file of template.files) {
    const parts = String(file.path || '').split('/').filter(Boolean);
    if (!parts.length) continue;
    const base = parts.pop();
    const parentId = ensureFolder(parts.join('/'));
    if (!parentId) continue;
    const id = createFile(base, parentId);
    if (!id) continue;
    updateContent(id, String(file.content ?? ''));
    if (!firstFileId) firstFileId = id;
    if (file.path === template.mainFile) mainFileId = id;
  }

  const target = mainFileId || firstFileId;
  if (target) openTab(target);
}

export default function ProjectTemplatesModal({ open, onClose, theme }) {
  const ctx = useFiles();
  const [selectedId, setSelectedId] = useState(PROJECT_TEMPLATES[0]?.id);
  const [projectName, setProjectName] = useState('');

  const selected = useMemo(
    () => PROJECT_TEMPLATES.find((t) => t.id === selectedId) || PROJECT_TEMPLATES[0],
    [selectedId]
  );

  useEffect(() => {
    if (open) {
      setSelectedId(PROJECT_TEMPLATES[0]?.id);
      setProjectName(PROJECT_TEMPLATES[0]?.rootName || '');
    }
  }, [open ]);

  if (!open) return null;

  const handleSelect = (template) => {
    setSelectedId(template.id);
    setProjectName(template.rootName || '');
  };

  const handleCreate = () => {
    if (!selected) return;
    const name = sanitizeName(projectName);
    createProjectFromTemplate(selected, name, ctx);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(10, 10, 12, 0.72)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New project from template"
        className="w-full max-w-2xl rounded-2xl border border-(--line) bg-(--paper-2) shadow-[0_24px_80px_rgba(0,0,0,0.5)] flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--line) shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-(--ink)">New Project</h2>
            <p className="text-xs font-mono text-(--muted) mt-0.5">
              Pick a starter — a full folder drops into your file tree.
            </p>
          </div>
          <button
            onClick={() => onClose?.()}
            aria-label="Close"
            className="p-2 rounded-lg text-(--muted) hover:text-(--ink) hover:bg-(--ink)/6 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-2 gap-3 px-6 py-5 overflow-y-auto custom-scrollbar">
          {PROJECT_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.icon] || FolderPlus;
            const isSelected = selected?.id === template.id;
            return (
              <button
                key={template.id}
                onClick={() => handleSelect(template)}
                className={`text-left rounded-xl border p-4 transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-(--ink)/5 shadow-[0_4px_18px_rgba(0,0,0,0.25)]'
                    : 'border-(--line) hover:border-(--ink)/25 hover:bg-(--ink)/3'
                }`}
                style={isSelected ? { borderColor: template.accent } : undefined}
              >
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3"
                  style={{ backgroundColor: `${template.accent}22`, color: template.accent }}
                >
                  <Icon size={18} />
                </span>
                <span className="block font-bold text-[13.5px] text-(--ink)">{template.name}</span>
                <span className="block text-[11.5px] font-mono text-(--muted) mt-1 leading-relaxed">
                  {template.tagline}
                </span>
                <span className="block text-[10px] font-mono text-(--muted) mt-2">
                  {template.files.length} files
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-(--line) shrink-0 flex items-center gap-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="Project folder name"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-(--line) bg-(--paper) text-[13px] font-mono text-(--ink) placeholder:text-(--muted) outline-none focus:border-(--blue)/60 transition-colors"
          />
          <button
            onClick={handleCreate}
            className="px-5 py-2.5 rounded-lg text-[13px] font-bold text-white bg-(--blue) hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}

// Host: holds modal state and opens on the 'synapse:new-project' window event.
export function ProjectTemplatesHost({ theme }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('synapse:new-project', handler);
    return () => window.removeEventListener('synapse:new-project', handler);
  }, []);

  return <ProjectTemplatesModal open={open} onClose={() => setOpen(false)} theme={theme} />;
}
