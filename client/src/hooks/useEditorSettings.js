import { useState, useCallback } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

const STORAGE_KEY = 'synapse-editor-settings';

const DEFAULTS = {
  fontSize: 15,
  wordWrap: 'off', // 'off' | 'on'
  minimap: true,
  editorTheme: 'auto', // 'auto' | 'dracula' | 'monokai' | 'night-owl' | 'github-dark'
  fontFamily: 'jetbrains', // 'jetbrains' | 'fira' | 'plex' | 'consolas'
  tabSize: 4, // 2 | 4 | 8
  lineHeight: 1.6,
  cursorStyle: 'line', // 'line' | 'block' | 'underline'
  formatOnType: false,
  stickyScroll: true,
  bracketColorization: true,
  renderWhitespace: 'selection', // 'none' | 'selection' | 'all'
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

/** Editor font families available in the palette. */
export const EDITOR_FONTS = [
  { id: 'jetbrains', label: 'JetBrains Mono', stack: "'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace" },
  { id: 'fira', label: 'Fira Code', stack: "'Fira Code', 'IBM Plex Mono', Consolas, monospace" },
  { id: 'plex', label: 'IBM Plex Mono', stack: "'IBM Plex Mono', Consolas, monospace" },
  { id: 'consolas', label: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
];

/** Resolve a font id to its Monaco font-family stack (falls back to JetBrains). */
export function fontStackFor(id) {
  const found = EDITOR_FONTS.find((f) => f.id === id);
  return found ? found.stack : EDITOR_FONTS[0].stack;
}

/** Resolve a font id to its display label (falls back to JetBrains label). */
export function fontLabelFor(id) {
  const found = EDITOR_FONTS.find((f) => f.id === id);
  return found ? found.label : EDITOR_FONTS[0].label;
}

/** Allowed tab sizes (cycles 2 → 4 → 8 → 2). */
export const TAB_SIZES = [2, 4, 8];

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

  const cycleFontFamily = useCallback(() => {
    setSettings((prev) => {
      const ids = EDITOR_FONTS.map((x) => x.id);
      const nextId = ids[(ids.indexOf(prev.fontFamily) + 1) % ids.length] || 'jetbrains';
      const next = { ...prev, fontFamily: nextId };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const cycleTabSize = useCallback(() => {
    setSettings((prev) => {
      const sizes = TAB_SIZES;
      const nextSize = sizes[(sizes.indexOf(prev.tabSize) + 1) % sizes.length] || 4;
      const next = { ...prev, tabSize: nextSize };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleFormatOnType = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, formatOnType: !prev.formatOnType };
      try {
        writeStorage(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleStickyScroll = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, stickyScroll: !prev.stickyScroll };
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
    cycleFontFamily,
    cycleTabSize,
    toggleFormatOnType,
    toggleStickyScroll,
  };
}
