import { useState, useRef, useEffect } from 'react';
import { useFiles } from '../contexts/FileContext';
import { getThemeClasses } from '../utils/theme';
import { readStorage, writeStorage } from '../utils/storage';
import {
  Files,
  Search,
  Users,
  MessageSquare,
  ChevronRight,
  FileCode,
  Trash2,
  FolderPlus,
  X,
  ChevronDown,
  Pencil,
  FilePlus,
  Copy,
  FolderSearch,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import FileTreeItem from './FileTreeItem';
import ChatPanel from './ChatPanel';
import { copyText } from '../utils/clipboard';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';

const SIDEBAR_WIDTH_KEY = 'synapse-primary-sidebar-width';
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 720;

function clampSidebarWidth(value) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
}

// ─── Context Menu Component ─────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose, theme }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className={`fixed z-9999 py-1.5 min-w-50 rounded-xl shadow-2xl border animate-scale-in ${
        theme === 'dark'
          ? 'syn-glass-strong'
          : 'bg-white/95 border-slate-200 shadow-slate-300/50'
      }`}
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={i} className="my-1.5 syn-divider opacity-60" />;
        }
        return (
          <button
            key={i}
            className={`w-full flex items-center gap-3 px-3.5 py-2 text-xs text-left transition-all duration-150 cursor-pointer ${
              theme === 'dark'
                ? 'text-slate-300 hover:bg-violet-500/15 hover:text-violet-200'
                : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
            }`}
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            {item.icon && <item.icon size={14} className={item.iconColor || ''} />}
            <span className="flex-1 font-medium">{item.label}</span>
            {item.shortcut && (
              <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Sidebar ───────────────────────────────────────────────────────────
export default function Sidebar({
  theme,
  collaborators = [],
  chatMessages = [],
  typingUsers = [],
  getSocket = () => null,
  roomId,
  currentUser,
  fileLocks = {},
}) {
  const { files, activeFileId, openTab, createFile, createFolder, moveItem, renameFile, deleteFile, toggleFolder, jumpToFileLine } = useFiles();
  const [activeSidebar, setActiveSidebar] = useState('explorer');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [creatingType, setCreatingType] = useState(null);
  const [createParentId, setCreateParentId] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDragId, setActiveDragId] = useState(null);
  const [overDragId, setOverDragId] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item }
  const [renameTargetId, setRenameTargetId] = useState(null);
  const [seenChatCount, setSeenChatCount] = useState(chatMessages.length);
  const [seenUserCount, setSeenUserCount] = useState(collaborators.length);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(readStorage(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(savedWidth)) {
      return clampSidebarWidth(savedWidth);
    }
    return 320;
  });
  const t = getThemeClasses(theme);

  const createCommittedRef = useRef(false);
  const createInputRef = useRef(null);
  const resizeStateRef = useRef(null);

  useEffect(() => {
    writeStorage(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX);
      setSidebarWidth(clampSidebarWidth(nextWidth));
    };

    const stopResizing = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, []);

  const effectiveSelectedItemId = selectedItemId || activeFileId || null;

  const hasNewUser = activeSidebar !== 'users' && collaborators.length > seenUserCount;
  const unreadMessages = Math.max(0, chatMessages.length - seenChatCount);
  const recentMessages = chatMessages.slice(Math.max(0, seenChatCount));
  const myName = (currentUser?.username || currentUser?.name || '').toLowerCase();
  const hasUnreadMention = activeSidebar !== 'chat' && recentMessages.some((msg) => {
    if (msg.type === 'system' || msg.senderId === currentUser?.userId) return false;
    return myName && msg.content?.toLowerCase().includes(`@${myName}`);
  });
  const hasUnreadMsgs = activeSidebar !== 'chat' && unreadMessages > 0 && !hasUnreadMention;

  // ─── Target folder logic ────────────────────────────────────────────
  const getTargetParentId = (itemOrId) => {
    const refId = itemOrId || effectiveSelectedItemId;
    if (!refId) return null;
    const item = files.find(f => f.id === refId);
    if (!item) return null;
    if (item.type === 'folder') return item.id;
    return item.parentId || null;
  };

  const startCreate = (type, contextItemId) => {
    createCommittedRef.current = false;
    const parentId = getTargetParentId(contextItemId);
    setCreateParentId(parentId);
    setCreatingType(type);
    setNewItemName('');
    if (parentId) {
      const parentFolder = files.find(f => f.id === parentId);
      if (parentFolder && !parentFolder.isOpen) {
        toggleFolder(parentId);
      }
    }
  };

  const handleCreateFile = () => {
    if (activeSidebar !== 'explorer') return;
    startCreate('file');
  };
  const handleCreateFolder = () => {
    if (activeSidebar !== 'explorer') return;
    startCreate('folder');
  };

  const commitCreate = () => {
    if (createCommittedRef.current) return;
    createCommittedRef.current = true;
    const trimmed = newItemName.trim();
    if (trimmed && creatingType === 'folder') {
      createFolder(trimmed, createParentId);
    } else if (trimmed && creatingType === 'file') {
      createFile(trimmed, createParentId);
    }
    setCreatingType(null);
    setCreateParentId(null);
    setNewItemName('');
  };

  const cancelCreate = () => {
    createCommittedRef.current = true;
    setCreatingType(null);
    setCreateParentId(null);
    setNewItemName('');
  };

  // ─── Context menu handler ──────────────────────────────────────────
  const handleItemContextMenu = (e, item) => {
    const isFolder = item.type === 'folder';
    const menuItems = [];

    if (isFolder) {
      menuItems.push({
        label: 'New File',
        icon: FilePlus,
        iconColor: 'text-violet-400',
        action: () => startCreate('file', item.id),
      });
      menuItems.push({
        label: 'New Folder',
        icon: FolderPlus,
        iconColor: 'text-amber-400',
        action: () => startCreate('folder', item.id),
      });
      menuItems.push({ type: 'separator' });
    }

    menuItems.push({
      label: 'Rename',
      icon: Pencil,
      iconColor: 'text-violet-400',
      shortcut: 'F2',
      action: () => setRenameTargetId(item.id),
    });
    menuItems.push({
      label: 'Delete',
      icon: Trash2,
      iconColor: 'text-rose-400',
      shortcut: 'Del',
      action: () => deleteFile(item.id),
    });

    menuItems.push({ type: 'separator' });

    if (!isFolder) {
      menuItems.push({
        label: 'New File Here',
        icon: FilePlus,
        iconColor: 'text-violet-400',
        action: () => startCreate('file', item.id),
      });
      menuItems.push({
        label: 'New Folder Here',
        icon: FolderPlus,
        iconColor: 'text-amber-400',
        action: () => startCreate('folder', item.id),
      });
      menuItems.push({ type: 'separator' });
    }

    menuItems.push({
      label: 'Copy Name',
      icon: Copy,
      action: () => copyText(item.name),
    });

    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  // ─── Rename trigger handling ───────────────────────────────────────
  // When renameTargetId is set by context menu, we pass it down to the matching FileTreeItem
  // and then clear it after the render
  useEffect(() => {
    if (renameTargetId) {
      const timer = setTimeout(() => setRenameTargetId(null), 100);
      return () => clearTimeout(timer);
    }
  }, [renameTargetId]);

  // ─── Flatten tree ──────────────────────────────────────────────────
  const getVisibleFiles = () => {
    const visible = [];
    const pushChildren = (parentId, depth) => {
      const children = files
        .filter(f => f.parentId === parentId)
        .sort((a, b) => {
          // 1. Folders always come before files
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          // 2. Within the same type, respect the manual order
          if (a.order !== b.order) return a.order - b.order;
          // 3. Fallback to name (alphabetic) if orders are identical
          return a.name.localeCompare(b.name);
        });

      if (creatingType && createParentId === parentId) {
        visible.push({ id: '__creating__', type: '__creating__', depth, parentId });
      }

      for (const child of children) {
        visible.push({ ...child, depth });
        if (child.type === 'folder' && child.isOpen) {
          pushChildren(child.id, depth + 1);
        }
      }
    };
    pushChildren(null, 0);
    return visible;
  };

  const visibleFiles = getVisibleFiles();

  // ─── DnD ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function getProjectedState(visibleItems, activeId, overId, deltaX) {
    const activeIndex = visibleItems.findIndex(f => f.id === activeId);
    let overIndex = visibleItems.findIndex(f => f.id === overId);

    if (activeIndex === -1) return null;
    if (overIndex === -1) overIndex = activeIndex;

    const activeItem = visibleItems[activeIndex];
    const depthOffset = Math.round(deltaX / 16);
    let projectedDepth = Math.max(0, activeItem.depth + depthOffset);

    const previousItemIndex = overIndex > activeIndex ? overIndex : overIndex - 1;
    const previousItem = previousItemIndex >= 0 ? visibleItems[previousItemIndex] : null;

    let maxDepth = 0;
    if (previousItem) {
      maxDepth = previousItem.depth;
      if (previousItem.type === 'folder' && previousItem.id !== activeId) {
        maxDepth += 1;
      }
    }

    projectedDepth = Math.min(projectedDepth, maxDepth);

    let projectedParentId = null;
    for (let i = previousItemIndex; i >= 0; i--) {
      const item = visibleItems[i];
      if (item.depth === projectedDepth - 1 && item.type === 'folder') {
        projectedParentId = item.id;
        break;
      }
    }

    if (projectedDepth === 0) projectedParentId = null;

    return { projectedDepth, projectedParentId, insertIndex: overIndex };
  }

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
    setOverDragId(event.active.id);
    setDragOffset(0);
  };

  const handleDragMove = (event) => {
    setDragOffset(event.delta.x);
    if (event.over) setOverDragId(event.over.id);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setOverDragId(null);
    setDragOffset(0);
  };

  const handleDragEnd = (event) => {
    const activeId = activeDragId;
    setActiveDragId(null);
    setOverDragId(null);
    setDragOffset(0);

    const { active, over } = event;
    if (!over || !activeId) return;

    if (active.id === over.id && dragOffset < 8 && dragOffset > -8) return;

    const projectedState = getProjectedState(visibleFiles, active.id, over.id, dragOffset);
    if (!projectedState) return;

    const { projectedParentId, insertIndex } = projectedState;

    // Calculate position among siblings of the projected parent.
    let siblingOrder = 0;
    for (let i = 0; i < insertIndex; i++) {
        if (visibleFiles[i].id === activeId) continue;
        if (visibleFiles[i].parentId === projectedParentId) {
            siblingOrder++;
        }
    }

    // If we are dropping on ourself, do nothing
    if (activeId === (over?.id || null) && siblingOrder === visibleFiles.findIndex(f => f.id === activeId)) return;

    moveItem(active.id, projectedParentId, siblingOrder);
  };

  const draggedItem = activeDragId ? visibleFiles.find(f => f.id === activeDragId) : null;

  // ─── Search ───────────────────────────────────────────────────────
  const searchResults = (() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results = [];
    files.forEach(file => {
      if (file.type === 'folder' || !file.content) return;
      const lines = file.content.split('\n');
      const matches = [];
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query)) {
          matches.push({ lineNumber: index + 1, content: line.trim() });
        }
      });
      if (matches.length > 0) {
        results.push({ file, matches });
      }
    });
    return results;
  })();

  // ─── Right-click on empty area of explorer ────────────────────────
  const handleExplorerContextMenu = (e) => {
    e.preventDefault();
    const menuItems = [
      {
        label: 'New File',
        icon: FilePlus,
        iconColor: 'text-violet-400',
        action: () => startCreate('file', null),
      },
      {
        label: 'New Folder',
        icon: FolderPlus,
        iconColor: 'text-amber-400',
        action: () => startCreate('folder', null),
      },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  // Click on empty space deselects
  const handleExplorerBgClick = () => {
    setSelectedItemId(null);
  };

  const handleSidebarToggle = (type) => {
    setActiveSidebar((prev) => {
      const next = prev === type ? null : type;

      if (next === 'users') {
        setSeenUserCount(collaborators.length);
      }

      if (next === 'chat') {
        setSeenChatCount(chatMessages.length);
      }

      return next;
    });
  };

  const startResizing = (event) => {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const activityTypes = roomId ? ['explorer', 'search', 'users', 'chat'] : ['explorer', 'search'];

  return (
    <>
      {/* Activity Bar */}
      <nav className={`w-13 rounded-2xl border flex flex-col items-center py-3 gap-1.5 shrink-0 overflow-hidden shadow-xl ${theme === 'dark' ? 'syn-glass shadow-black/40' : 'bg-white/85 border-slate-200 shadow-slate-300/40 backdrop-blur-xl'}`}>
        {activityTypes.map((type) => {
          const isActive = activeSidebar === type;
          return (
            <button
              key={type}
              onClick={() => handleSidebarToggle(type)}
              className={`relative p-2.5 rounded-xl transition-all duration-200 cursor-pointer group ${
                isActive
                  ? 'text-violet-400 bg-violet-500/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : theme === 'dark'
                    ? 'text-slate-500 hover:text-slate-200 hover:bg-white/6'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title={type.charAt(0).toUpperCase() + type.slice(1)}
            >
              {isActive && (
                <span className="absolute left-2.25 top-1/2 -translate-y-1/2 w-0.75 h-6 rounded-full bg-linear-to-b from-violet-400 to-cyan-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              )}
              {type === 'explorer' && <Files size={19} className="group-hover:scale-110 transition-transform" />}
              {type === 'search' && <Search size={19} className="group-hover:scale-110 transition-transform" />}
              {type === 'users' && (
                <span className="relative inline-flex">
                  <Users size={19} className="group-hover:scale-110 transition-transform" />
                  {hasNewUser && (
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 ${theme === 'dark' ? 'border-[#0d1117]' : 'border-white'} shadow-[0_0_6px_rgba(52,211,153,0.8)] z-10 animate-pulse`} />
                  )}
                </span>
              )}
              {type === 'chat' && (
                <span className="relative inline-flex">
                  <MessageSquare size={19} className="group-hover:scale-110 transition-transform" />
                  {hasUnreadMention && (
                    <span className={`absolute -top-2 -left-2 w-5 h-5 bg-linear-to-br from-violet-500 to-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 ${theme === 'dark' ? 'border-white/20' : 'border-violet-100'} shadow-[0_0_10px_rgba(139,92,246,0.7)] animate-pulse z-20`}>
                      @
                    </span>
                  )}
                  {hasUnreadMsgs && (
                    <span className={`absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 ${theme === 'dark' ? 'border-[#0d1117]' : 'border-white'} shadow-sm z-10`}>
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <div className={`w-6 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
        <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-emerald-500'} animate-pulse`} title="Connected" />
      </nav>

      {/* Primary Sidebar */}
      {activeSidebar && (
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className={`relative rounded-2xl border shadow-xl flex flex-col transition-[width] duration-200 shrink-0 overflow-hidden min-w-0 animate-fade-in ${theme === 'dark' ? 'syn-glass shadow-black/40' : 'bg-white/85 border-slate-200 shadow-slate-300/40 backdrop-blur-xl'}`}
        >
          <button
            type="button"
            aria-label="Resize sidebar"
            onPointerDown={startResizing}
            className="absolute right-0 top-0 z-20 h-full w-3 translate-x-1/2 cursor-col-resize hover:bg-violet-500/20 transition-colors"
          >
            <span className="sr-only">Resize</span>
          </button>

          {/* Panel header */}
          <div className={`px-4 py-3 flex justify-between items-center shrink-0 border-b ${t.border}`}>
            <span className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-[0.18em]`}>
              {activeSidebar === 'explorer' && "Explorer"}
              {activeSidebar === 'search' && "Search"}
              {activeSidebar === 'users' && "Collaborators"}
              {activeSidebar === 'chat' && "Room Chat"}
            </span>
            {activeSidebar === 'explorer' && (
              <div className="flex gap-1">
                <button className={t.iconBtn + ' p-1.5!'} title="New File" onClick={handleCreateFile}>
                  <FilePlus size={15} />
                </button>
                <button className={t.iconBtn + ' p-1.5!'} title="New Folder" onClick={handleCreateFolder}>
                  <FolderPlus size={15} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            {activeSidebar === 'explorer' && (
              <div
                className="flex flex-col min-h-full py-2"
                onClick={handleExplorerBgClick}
                onContextMenu={handleExplorerContextMenu}
              >
                <div className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] ${t.textMuted} cursor-default select-none`}>
                  <ChevronRight size={13} className="rotate-90 text-violet-400" />
                  <span>Project Files</span>
                  <span className={`${t.chip} ml-auto text-[9px]!`}>{files.filter(f => f.type === 'file').length}</span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext items={visibleFiles.filter(f => f.id !== '__creating__').map(f => f.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col px-1">
                      {visibleFiles.map(file => {
                        if (file.id === '__creating__') {
                          const inputDepth = file.depth;
                          return (
                            <div
                              key="__creating__"
                              className={`relative flex items-center gap-2 py-1.5 rounded-lg mx-1.5 animate-fade-in ${theme === 'dark' ? 'bg-violet-500/10 ring-1 ring-violet-500/30' : 'bg-violet-50 ring-1 ring-violet-300'}`}
                              style={{ paddingLeft: `${inputDepth * 16 + 12}px` }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {creatingType === 'folder'
                                ? <FolderPlus size={15} className="text-amber-400/90 shrink-0" />
                                : <FileCode size={15} className="text-violet-400 shrink-0" />
                              }
                              <input
                                ref={createInputRef}
                                autoFocus
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitCreate(); }
                                  if (e.key === 'Escape') { e.preventDefault(); cancelCreate(); }
                                }}
                                onBlur={() => setTimeout(() => commitCreate(), 50)}
                                placeholder={creatingType === 'folder' ? "folder name…" : "filename.ext"}
                                className={`flex-1 min-w-0 text-[13px] outline-none py-1 px-2 rounded-lg font-mono syn-focus-ring ${theme === 'dark' ? 'bg-[#12121f] text-violet-200 border border-violet-500/40' : 'bg-white text-violet-700 border border-violet-300'}`}
                              />
                            </div>
                          );
                        }

                        const isDragged = file.id === activeDragId;
                        let displayDepth = file.depth;
                        if (isDragged && overDragId) {
                          const proj = getProjectedState(visibleFiles, activeDragId, overDragId, dragOffset);
                          if (proj) displayDepth = proj.projectedDepth;
                        }

                        return (
                          <FileTreeItem
                            key={file.id}
                            item={{ ...file, _triggerRename: renameTargetId === file.id }}
                            depth={displayDepth}
                            activeFileId={activeFileId}
                            selectedItemId={effectiveSelectedItemId}
                            fileLock={fileLocks[file.id]}
                            currentUserId={currentUser?.userId}
                            onOpenTempFile={openTab}
                            onDeleteFile={deleteFile}
                            onToggleFolder={toggleFolder}
                            onRenameFile={renameFile}
                            onSelect={setSelectedItemId}
                            onContextMenu={handleItemContextMenu}
                            themeClasses={t}
                            theme={theme}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>
                    {draggedItem ? (
                      <div className={`text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-2xl border animate-scale-in ${
                        theme === 'dark'
                          ? 'syn-glass-strong text-slate-200'
                          : 'bg-white border-violet-200 text-slate-700'
                      }`}>
                        {draggedItem.type === 'folder'
                          ? <FolderPlus size={14} className="text-amber-400" />
                          : <FileCode size={14} className="text-violet-400" />
                        }
                        <span className="font-mono">{draggedItem.name}</span>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {/* Empty space fill for right-click */}
                <div className="flex-1 min-h-10" />
              </div>
            )}

            {activeSidebar === 'search' && (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 focus-within:border-violet-500/50 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] ${theme === 'dark' ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <Search size={14} className={t.textMuted} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search codebase…"
                      className={`w-full bg-transparent text-xs outline-none ${t.textPrimary} placeholder:${t.textMuted}`}
                      autoFocus
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className={`${t.textMuted} hover:text-rose-400 transition-colors cursor-pointer`}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3">
                  {!searchQuery.trim() ? (
                    <div className={`flex flex-col items-center gap-2 text-xs ${t.textMuted} text-center py-10 animate-fade-in`}>
                      <FolderSearch size={28} className="opacity-40" />
                      <span>Type to search across all files</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className={`text-xs ${t.textMuted} text-center py-10 animate-fade-in`}>
                      No results for <span className="font-mono text-violet-400">"{searchQuery}"</span>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in">
                      <div className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.14em] px-1">
                        {searchResults.reduce((acc, curr) => acc + curr.matches.length, 0)} results · {searchResults.length} files
                      </div>
                      {searchResults.map(({ file, matches }) => (
                        <div key={file.id} className="flex flex-col">
                          <button
                            className={`flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${t.text} hover:text-violet-300 ${theme === 'dark' ? 'hover:bg-white/4' : 'hover:bg-slate-100'}`}
                            onClick={() => openTab(file.id)}
                          >
                            <ChevronDown size={13} className={t.textMuted} />
                            <FileCode size={13} className={activeFileId === file.id ? 'text-violet-400' : t.textMuted} />
                            <span className="truncate font-mono">{file.name}</span>
                          </button>
                          <div className="flex flex-col pl-5 mt-0.5">
                            {matches.map((match, i) => (
                              <button
                                key={i}
                                className={`group flex items-start gap-2.5 px-2 py-1 cursor-pointer rounded-lg transition-colors text-left ${theme === 'dark' ? 'hover:bg-violet-500/10' : 'hover:bg-violet-50'}`}
                                onClick={() => jumpToFileLine(file.id, match.lineNumber)}
                              >
                                <span className={`text-[11px] tabular-nums shrink-0 mt-px font-mono ${t.textMuted} group-hover:text-violet-400 transition-colors`}>
                                  {match.lineNumber}
                                </span>
                                <span className={`font-mono text-[11px] truncate ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-600 group-hover:text-slate-900'} transition-colors`}>
                                  {match.content}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSidebar === 'users' && (
              <div className="px-2.5 space-y-1 py-2">
                {collaborators.map((user, i) => {
                  const isOnline = user.status !== 'offline';
                  const userGlyph = getUserInitial(user);
                  const avatarStyle = getAvatarStyle(user, user.cursorColor || user.color);
                  return (
                    <div
                      key={user.userId || user.id}
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`animate-fade-up flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-px ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md ring-2 ring-white/10"
                          style={avatarStyle}
                        >
                          {userGlyph}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${theme === 'dark' ? 'border-[#0d1117]' : 'border-white'} ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-semibold ${t.textPrimary} truncate`}>
                          {user.username || user.name} {user.isYou && <span className="text-violet-400 font-medium">(You)</span>}
                        </span>
                        <span className={`text-[10px] ${t.textMuted} flex items-center gap-1`}>
                          <span className={`w-1 h-1 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {collaborators.length === 0 && (
                  <div className={`flex flex-col items-center gap-2 text-xs ${t.textMuted} text-center py-10 animate-fade-in`}>
                    <Users size={26} className="opacity-40" />
                    <span>No peers connected yet.<br />Share the invite link!</span>
                  </div>
                )}
              </div>
            )}

            {activeSidebar === 'chat' && (
              <ChatPanel
                theme={theme}
                themeClasses={t}
                chatMessages={chatMessages}
                typingUsers={typingUsers}
                getSocket={getSocket}
                roomId={roomId}
                currentUser={currentUser}
                collaborators={collaborators}
              />
            )}
          </div>
        </aside>
      )}

      {/* Context Menu Portal */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
          theme={theme}
        />
      )}
    </>
  );
}
