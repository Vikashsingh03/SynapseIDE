import { useEffect, useMemo, useRef } from 'react';
import { useFiles } from '../contexts/FileContext';
import { readStorage, writeStorage } from '../utils/storage';

export const TAB_SESSION_STORAGE_PREFIX = 'synapse-tab-session:';
export const MAX_CLOSED_TABS = 20;
const PERSIST_DEBOUNCE_MS = 300;

export function getWorkspaceKeyFromPath(pathname) {
  const match = typeof pathname === 'string' ? pathname.match(/^\/room\/([^/?#]+)/) : null;
  if (match) {
    try {
      return `room:${decodeURIComponent(match[1])}`;
    } catch {
      return `room:${match[1]}`;
    }
  }
  return 'solo';
}

export function getTabSessionStorageKey(workspaceKey) {
  return `${TAB_SESSION_STORAGE_PREFIX}${workspaceKey}`;
}

export function parseTabSession(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      openIds: Array.isArray(data.openIds) ? data.openIds.filter((id) => typeof id === 'string') : [],
      activeId: typeof data.activeId === 'string' ? data.activeId : null,
      closed: Array.isArray(data.closed) ? data.closed.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function pushClosedTabId(stack, id, max = MAX_CLOSED_TABS) {
  const base = Array.isArray(stack) ? stack.filter((entry) => entry !== id) : [];
  if (!id) return base;
  base.push(id);
  return max > 0 ? base.slice(-max) : base;
}

export function filterRestorableTabIds(openIds, files) {
  const valid = new Set(
    (Array.isArray(files) ? files : []).filter((file) => file && file.type !== 'folder').map((file) => file.id)
  );
  const seen = new Set();
  const result = [];
  for (const id of Array.isArray(openIds) ? openIds : []) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function takeNextClosedTabId(stack, openIds, files) {
  const valid = new Set(
    (Array.isArray(files) ? files : []).filter((file) => file && file.type !== 'folder').map((file) => file.id)
  );
  const open = new Set(Array.isArray(openIds) ? openIds : []);
  const next = Array.isArray(stack) ? [...stack] : [];
  while (next.length) {
    const candidate = next.pop();
    if (valid.has(candidate) && !open.has(candidate)) {
      return { id: candidate, stack: next };
    }
  }
  return { id: null, stack: next };
}

export function readClosedTabStack(workspaceKey, storage) {
  try {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return [];
    const session = parseTabSession(store.getItem(getTabSessionStorageKey(workspaceKey)));
    return session ? session.closed : [];
  } catch {
    return [];
  }
}

export default function TabSessionManager() {
  const { files, openTabs, activeFileId, openTab, closeTab, setActiveFileId } = useFiles();

  const workspaceKey = useMemo(
    () => getWorkspaceKeyFromPath(typeof window !== 'undefined' ? window.location.pathname : ''),
    []
  );
  const storageKey = getTabSessionStorageKey(workspaceKey);

  const restoredRef = useRef(false);
  const prevTabsRef = useRef(openTabs);
  const prevFilesRef = useRef(files);
  const filesChangedRef = useRef(false);
  const closedRef = useRef([]);
  const closedLoadedRef = useRef(false);
  const latestRef = useRef({ files, openTabs, activeFileId });
  latestRef.current = { files, openTabs, activeFileId };

  const ensureClosedLoaded = () => {
    if (closedLoadedRef.current) return;
    closedLoadedRef.current = true;
    const session = parseTabSession(readStorage(storageKey));
    closedRef.current = session ? session.closed : [];
  };

  const announceClosed = () => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
      window.dispatchEvent(
        new CustomEvent('synapse:closed-tabs-changed', {
          detail: { workspaceKey, closed: [...closedRef.current] },
        })
      );
    } catch {}
  };

  const persistNow = () => {
    ensureClosedLoaded();
    writeStorage(
      storageKey,
      JSON.stringify({
        openIds: latestRef.current.openTabs,
        activeId: latestRef.current.activeFileId,
        closed: closedRef.current,
      })
    );
  };

  useEffect(() => {
    if (prevFilesRef.current !== files) {
      filesChangedRef.current = true;
      prevFilesRef.current = files;
    }
    if (restoredRef.current) return;
    if (!files.length) return;

    const session = parseTabSession(readStorage(storageKey));
    if (!session || !session.openIds.length) {
      restoredRef.current = true;
      prevTabsRef.current = openTabs;
      ensureClosedLoaded();
      return;
    }

    const target = filterRestorableTabIds(session.openIds, files);
    if (!target.length) {
      if (workspaceKey === 'solo' || filesChangedRef.current) {
        restoredRef.current = true;
        prevTabsRef.current = openTabs;
        ensureClosedLoaded();
      }
      return;
    }

    restoredRef.current = true;
    closedLoadedRef.current = true;
    closedRef.current = session.closed;
    target.forEach((id) => openTab(id));
    openTabs.filter((id) => !target.includes(id)).forEach((id) => closeTab(id));
    if (session.activeId && target.includes(session.activeId)) {
      setActiveFileId(session.activeId);
    }
    prevTabsRef.current = target;
  }, [files, openTabs, storageKey, workspaceKey, openTab, closeTab, setActiveFileId]);

  useEffect(() => {
    if (!restoredRef.current) {
      prevTabsRef.current = openTabs;
      return undefined;
    }

    ensureClosedLoaded();
    const removed = prevTabsRef.current.filter((id) => !openTabs.includes(id));
    prevTabsRef.current = openTabs;
    let closedChanged = false;
    for (const id of removed) {
      if (files.some((file) => file.id === id)) {
        closedRef.current = pushClosedTabId(closedRef.current, id);
        closedChanged = true;
      }
    }
    if (closedChanged) announceClosed();

    const timer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [files, openTabs, activeFileId, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || !event.shiftKey) return;
      if ((event.key || '').toLowerCase() !== 't') return;
      event.preventDefault();

      ensureClosedLoaded();
      const { files: currentFiles, openTabs: currentTabs } = latestRef.current;
      const result = takeNextClosedTabId(closedRef.current, currentTabs, currentFiles);
      closedRef.current = result.stack;
      if (result.id) {
        openTab(result.id);
      }
      persistNow();
      announceClosed();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [storageKey, openTab]);

  return null;
}
