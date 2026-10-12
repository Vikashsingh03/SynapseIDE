import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Folder, FolderOpen, Lock, Trash2, Pencil, ChevronRight,
  FileCode, FileText, FileJson, FileType, File, Braces, Hash,
  Code, Terminal, Image, Settings, Database
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

// Editorial v3: file-type icons stay distinct (Lucide), monochrome with
// the v3 blue accent on the active file.
function getFileIcon(name, isActive) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

  const iconMap = {
    js: Braces, jsx: Braces, ts: Braces, tsx: Braces,
    py: Hash,
    html: Code, css: FileType, scss: FileType,
    json: FileJson, xml: FileCode, yaml: FileText, yml: FileText, env: Settings,
    java: FileCode, cpp: FileCode, c: FileCode, h: FileCode,
    sh: Terminal, bat: Terminal,
    md: FileText, txt: FileText,
    png: Image, jpg: Image, svg: Image,
    sql: Database, db: Database,
  };

  const Icon = iconMap[ext] || File;
  return (
    <Icon
      size={14}
      className={`shrink-0 ${isActive ? 'text-(--blue)' : 'text-(--muted)'}`}
    />
  );
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

  // Neutral indent guides (v3 hairline)
  const indentGuides = [];
  const guideColor = 'var(--line)';
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

  // Determine background state — v3: red inset indicator for the active file
  let stateClass = '';
  if (isDropTarget) {
    stateClass = 'bg-(--blue)/10 ring-1 ring-inset ring-(--blue)/40';
  } else if (isActive) {
    stateClass = 'bg-(--blue)/8 text-(--ink) shadow-[inset_2px_0_0_0_var(--red)]';
  } else if (isSelected) {
    stateClass = 'bg-(--ink)/5 text-(--ink)';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center justify-between group text-[13px] cursor-pointer select-none rounded-md mx-1 my-px
        transition-colors duration-150
        ${stateClass}
        ${!isActive && !isSelected && !isDropTarget ? 'text-(--muted) hover:bg-(--ink)/4' : ''}
        ${isDragging ? 'z-10' : ''}
      `}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...attributes}
      {...listeners}
    >
      {/* Indent guide lines */}
      {depth > 0 && indentGuides}

      {/* Content with proper indentation */}
      <div
        className="flex items-center gap-1.5 py-1 pr-3 truncate min-w-0 flex-1"
        style={{ paddingLeft: `${depth * 16 + 10}px` }}
      >
        {/* Folder chevron or spacer */}
        {isFolder ? (
          <ChevronRight
            size={12}
            className={`shrink-0 transition-transform duration-150 ${item.isOpen ? 'rotate-90' : ''} ${t.textMuted}`}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {confirmDelete ? (
          <div className="flex items-center justify-between w-full animate-fade-in">
            <span className={`font-medium text-[11px] text-(--muted)`}>
              Delete this {isFolder ? 'folder' : 'file'}?
            </span>
            <div className="flex gap-1.5 ml-2">
              <button
                className="px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors border bg-(--red)/10 text-(--red) border-(--red)/30 hover:bg-(--red) hover:text-white"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDeleteFile(item.id);
                  setConfirmDelete(false);
                }}
              >
                Delete
              </button>
              <button
                className="text-(--muted) px-2 py-0.5 rounded-md hover:bg-(--ink)/6 text-[11px] cursor-pointer transition-colors"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File/Folder icon */}
            {isFolder ? (
              item.isOpen
                ? <FolderOpen size={15} className={`shrink-0 ${isActive ? 'text-(--blue)' : 'text-(--muted)'}`} />
                : <Folder size={15} className={`shrink-0 ${isActive ? 'text-(--blue)' : 'text-(--muted)'}`} />
            ) : (
              getFileIcon(item.name, isActive)
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
                className="flex-1 min-w-0 text-[13px] outline-none py-0.5 px-1.5 rounded-md border bg-(--paper) text-(--ink) border-(--blue)/60"
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
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold shrink-0 border ${
                  isLockedByOther
                    ? theme === 'dark'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                    : theme === 'dark'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200'
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
            className="p-1 rounded-md cursor-pointer transition-colors text-(--muted) hover:text-(--ink) hover:bg-(--ink)/6"
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
            className="p-1 rounded-md cursor-pointer transition-colors text-(--muted) hover:text-(--red) hover:bg-(--ink)/6"
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
