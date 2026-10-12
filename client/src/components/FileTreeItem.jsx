import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Folder, FolderOpen, Lock, Trash2, Pencil, ChevronRight,
  FileCode, FileText, FileJson, FileType, File, Braces, Hash,
  Code, Terminal, Image, Settings, Database
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

// VS Code-style file icon mapping
function getFileIcon(name, isActive, mutedClass) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const activeColor = 'text-violet-400';

  const iconMap = {
    // JavaScript / TypeScript
    js:   { Icon: Braces,    color: 'text-yellow-400' },
    jsx:  { Icon: Braces,    color: 'text-sky-400' },
    ts:   { Icon: Braces,    color: 'text-blue-400' },
    tsx:  { Icon: Braces,    color: 'text-blue-400' },
    // Python
    py:   { Icon: Hash,      color: 'text-green-400' },
    // Web
    html: { Icon: Code,      color: 'text-orange-400' },
    css:  { Icon: FileType,  color: 'text-blue-400' },
    scss: { Icon: FileType,  color: 'text-pink-400' },
    // Data
    json: { Icon: FileJson,  color: 'text-yellow-500' },
    xml:  { Icon: FileCode,  color: 'text-orange-300' },
    yaml: { Icon: FileText,  color: 'text-red-300' },
    yml:  { Icon: FileText,  color: 'text-red-300' },
    env:  { Icon: Settings,  color: 'text-yellow-600' },
    // Java / C
    java: { Icon: FileCode,  color: 'text-red-400' },
    cpp:  { Icon: FileCode,  color: 'text-blue-500' },
    c:    { Icon: FileCode,  color: 'text-blue-400' },
    h:    { Icon: FileCode,  color: 'text-purple-400' },
    // Shell
    sh:   { Icon: Terminal,  color: 'text-green-500' },
    bat:  { Icon: Terminal,  color: 'text-green-400' },
    // Markdown / Text
    md:   { Icon: FileText,  color: 'text-sky-300' },
    txt:  { Icon: FileText,  color: 'text-slate-400' },
    // Images
    png:  { Icon: Image,     color: 'text-emerald-400' },
    jpg:  { Icon: Image,     color: 'text-emerald-400' },
    svg:  { Icon: Image,     color: 'text-amber-400' },
    // Database
    sql:  { Icon: Database,  color: 'text-blue-300' },
    db:   { Icon: Database,  color: 'text-slate-400' },
  };

  const match = iconMap[ext];
  if (match) {
    const { Icon, color } = match;
    return <Icon size={14} className={`shrink-0 ${isActive ? activeColor : color}`} />;
  }
  return <File size={14} className={`shrink-0 ${isActive ? activeColor : mutedClass}`} />;
}

export default function FileTreeItem({
  item,
  depth,
  activeFileId,
  selectedItemId,
  fileLock,
  currentUserId,
  onOpenTempFile,
  onDeleteFile,
  onToggleFolder,
  onRenameFile,
  onSelect,
  onContextMenu,
  themeClasses: t,
  theme = 'dark',
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: item.id, data: { ...item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isFolder = item.type === 'folder';
  const isActive = activeFileId === item.id;
  const isSelected = selectedItemId === item.id;
  const isLockedByOther = Boolean(fileLock?.userId && fileLock.userId !== currentUserId);
  const isDropTarget = isOver && isFolder && !isDragging;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const renameInputRef = useRef(null);
  const renameCommittedRef = useRef(false);

  const startRenaming = useCallback(() => {
    renameCommittedRef.current = false;
    setRenameValue(item.name);
    setIsRenaming(true);
  }, [item.name]);

  // Allow parent to trigger rename via ref
  useEffect(() => {
    if (item._triggerRename) {
      const timer = window.setTimeout(() => startRenaming(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [item._triggerRename, startRenaming]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      if (!isFolder) {
        const dotIndex = renameValue.lastIndexOf('.');
        if (dotIndex > 0) {
          renameInputRef.current.setSelectionRange(0, dotIndex);
        } else {
          renameInputRef.current.select();
        }
      } else {
        renameInputRef.current.select();
      }
    }
  }, [isRenaming, isFolder, renameValue]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isRenaming) return;
    // Select the item first
    onSelect?.(item.id);
    if (isFolder) {
      onToggleFolder(item.id);
    } else {
      onOpenTempFile(item.id);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    startRenaming();
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(item.id);
    onContextMenu?.(e, item);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'F2' && !isRenaming) {
      e.preventDefault();
      startRenaming();
    }
    if (e.key === 'Delete' && !isRenaming) {
      e.preventDefault();
      setConfirmDelete(true);
    }
  };

  const commitRename = () => {
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== item.name && onRenameFile) {
      onRenameFile(item.id, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    renameCommittedRef.current = true;
    setRenameValue(item.name);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  // VS Code-style indent guides
  const indentGuides = [];
  const guideColor = theme === 'dark' ? 'rgba(139,92,246,0.14)' : 'rgba(0,0,0,0.08)';
  for (let i = 0; i < depth; i++) {
    indentGuides.push(
      <div
        key={i}
        className="absolute top-0 bottom-0"
        style={{
          left: `${i * 16 + 22}px`,
          width: '1px',
          backgroundColor: guideColor,
        }}
      />
    );
  }

  // Determine background state
  let stateClass = '';
  if (isDropTarget) {
    stateClass = 'bg-violet-500/20 ring-1 ring-violet-500/50 ring-inset';
  } else if (isActive) {
    stateClass = theme === 'dark'
      ? 'bg-violet-500/[0.14] text-violet-200 shadow-[inset_2px_0_0_0_#8b5cf6]'
      : 'bg-violet-50 text-violet-700 shadow-[inset_2px_0_0_0_#8b5cf6]';
  } else if (isSelected) {
    stateClass = theme === 'dark'
      ? 'bg-white/[0.06] text-slate-100'
      : 'bg-slate-200/70 text-slate-800';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center justify-between group text-[13px] cursor-pointer select-none rounded-lg mx-1.5 my-px
        transition-all duration-150
        ${stateClass}
        ${!isActive && !isSelected && !isDropTarget ? `${t.text} hover:bg-white/4 hover:text-violet-300` : ''}
        ${isDragging ? 'z-10' : ''}
      `}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...attributes}
      {...listeners}
    >
      {/* VS Code indent guide lines */}
      {depth > 0 && indentGuides}

      {/* Content with proper indentation */}
      <div
        className="flex items-center gap-1.5 py-1.25 pr-3 truncate min-w-0 flex-1"
        style={{ paddingLeft: `${depth * 16 + 10}px` }}
      >
        {/* Folder chevron or spacer */}
        {isFolder ? (
          <ChevronRight
            size={12}
            className={`shrink-0 transition-transform duration-150 ${item.isOpen ? 'rotate-90 text-violet-400' : ''} ${t.textMuted}`}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {confirmDelete ? (
          <div className="flex items-center justify-between w-full animate-fade-in">
            <span className="text-rose-400 font-semibold text-[11px]">Delete this {isFolder ? 'folder' : 'file'}?</span>
            <div className="flex gap-2 ml-2">
              <button
                className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDeleteFile(item.id);
                  setConfirmDelete(false);
                }}
              >
                Yes
              </button>
              <button
                className={`${t.textMuted} px-2 py-0.5 rounded-md hover:bg-white/10 text-[11px] cursor-pointer transition-colors`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File/Folder icon */}
            {isFolder ? (
              item.isOpen
                ? <FolderOpen size={15} className={`shrink-0 ${isActive ? 'text-violet-300' : 'text-amber-400/80'}`} />
                : <Folder size={15} className={`shrink-0 ${isActive ? 'text-violet-300' : 'text-amber-400/60'}`} />
            ) : (
              getFileIcon(item.name, isActive, t.textMuted)
            )}

            {/* Name or rename input */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={() => setTimeout(commitRename, 50)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className={`flex-1 min-w-0 text-[13px] outline-none py-0.5 px-1.5 rounded-lg syn-focus-ring ${
                  theme === 'dark'
                    ? 'bg-[#141422] text-violet-200 border border-violet-500/50'
                    : 'bg-white text-violet-700 border border-violet-500/50'
                }`}
              />
            ) : (
              <span
                className="truncate font-medium"
                onDoubleClick={handleDoubleClick}
              >
                {item.name}
              </span>
            )}

            {/* Lock indicator */}
            {!isFolder && !isRenaming && fileLock && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 border ${
                  isLockedByOther
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                }`}
                title={isLockedByOther ? `${fileLock.username || 'Someone'} is editing` : 'You are editing'}
              >
                <Lock size={9} />
                <span>{isLockedByOther ? fileLock.username || 'Busy' : 'You'}</span>
              </span>
            )}
          </>
        )}
      </div>

      {/* Action buttons on hover */}
      {!isRenaming && !confirmDelete && (
        <div className="flex items-center gap-0.5 shrink-0 pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            className="p-1 rounded-md text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              startRenaming();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Rename (F2)"
          >
            <Pencil size={12} />
          </button>
          <button
            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
