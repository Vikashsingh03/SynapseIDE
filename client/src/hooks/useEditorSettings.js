import { useState, useCallback } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

const STORAGE_KEY = 'synapse-editor-settings';

const DEFAULTS = {
  fontSize: 15,
  wordWrap: 'off', // 'off' | 'on'
  minimap: true,
  editorTheme: 'auto', // 'auto' | 'dracula' | 'monokai' | 'night-owl' | 'github-dark'
};

/** Editor color themes available in the palette (auto = follow app theme). */
export const EDITOR_THEMES = [
  { id: 'auto', label: 'Auto (follow app)' },
  { id: 'synapse-dark-plus', label: 'Dark+ (VS Code)' },
  { id: 'synapse-midnight', label: 'Synapse Midnight' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'night-owl', label: 'Night Owl' },
  { id: 'github-dark', label: 'GitHub Dark' },
];

const MIN_FONT = 11;
const MAX_FONT = 28;

/**
 * Persists personal editor preferences (font size, word wrap, minimap)
 * to localStorage. Consumed by EditorPanel's Monaco options and toggled
 * from the Command Palette.
 */
export function useEditorSettings() {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULTS,
    ...(readStorage(STORAGE_KEY) || {}),
  }));

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next;
    });
  }, []);

  const increaseFont = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, fontSize: Math.min(MAX_FONT, prev.fontSize + 1) };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const decreaseFont = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, fontSize: Math.max(MIN_FONT, prev.fontSize - 1) };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleWordWrap = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, wordWrap: prev.wordWrap === 'on' ? 'off' : 'on' };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleMinimap = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, minimap: !prev.minimap };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const cycleEditorTheme = useCallback(() => {
    setSettings((prev) => {
      const ids = EDITOR_THEMES.map((x) => x.id);
      const nextId = ids[(ids.indexOf(prev.editorTheme) + 1) % ids.length] || 'auto';
      const next = { ...prev, editorTheme: nextId };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return {
    settings,
    update,
    increaseFont,
    decreaseFont,
    toggleWordWrap,
    toggleMinimap,
    cycleEditorTheme,
  };
}
