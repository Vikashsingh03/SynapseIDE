export const KEYBINDINGS_STORAGE_KEY = 'synapse-keybindings';

export const COMMANDS = [
  { id: 'quickOpen', label: 'Quick Open — jump to a file', event: 'synapse:quick-open', defaultChord: 'Ctrl+P' },
  { id: 'livePreview', label: 'Open Live Preview', event: 'synapse:open-preview', defaultChord: 'Alt+P' },
  { id: 'testExplorer', label: 'Open Test Explorer', event: 'synapse:open-tests', defaultChord: 'Alt+T' },
  { id: 'timeline', label: 'Open Timeline (Local History)', event: 'synapse:open-timeline', defaultChord: 'Alt+L' },
  { id: 'readme', label: 'Generate README with Neura', event: 'synapse:generate-readme', defaultChord: 'Alt+R' },
  { id: 'zenMode', label: 'Toggle Zen Mode', event: 'synapse:toggle-zen', defaultChord: 'Alt+Z' },
];

export const FIXED_SHORTCUTS = [
  { chord: 'Ctrl+K', label: 'Command Palette' },
  { chord: 'Ctrl+S', label: 'Save File' },
  { chord: 'Ctrl+Shift+T', label: 'Reopen Closed Tab' },
];

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

function defaultStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseChord(chord) {
  if (typeof chord !== 'string' || !chord.trim()) return null;
  const parts = chord
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts[parts.length - 1];
  if (MODIFIER_KEYS.has(key)) return null;
  if (['ctrl', 'alt', 'shift', 'meta', 'cmd', 'command'].includes(key.toLowerCase())) return null;
  const mods = new Set(parts.slice(0, -1).map((s) => s.toLowerCase()));
  return {
    ctrl: mods.has('ctrl') || mods.has('control'),
    alt: mods.has('alt'),
    shift: mods.has('shift'),
    meta: mods.has('meta') || mods.has('cmd') || mods.has('command'),
    key: key.length === 1 ? key.toUpperCase() : key,
  };
}

export function normalizeChord(chord) {
  const parsed = parseChord(chord);
  if (!parsed) return null;
  const parts = [];
  if (parsed.ctrl) parts.push('Ctrl');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta) parts.push('Meta');
  parts.push(parsed.key);
  return parts.join('+');
}

export function chordFromEvent(e) {
  if (!e || typeof e.key !== 'string' || !e.key) return null;
  if (MODIFIER_KEYS.has(e.key)) return null;
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
}

export function eventMatchesChord(e, chord) {
  const target = normalizeChord(chord);
  if (!target) return false;
  const fromEvent = chordFromEvent(e);
  if (!fromEvent) return false;
  return fromEvent === target;
}

export function loadBindings(storage) {
  const store = storage || defaultStorage();
  if (!store) return {};
  let raw = null;
  try {
    raw = store.getItem(KEYBINDINGS_STORAGE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out = {};
  for (const cmd of COMMANDS) {
    const value = parsed[cmd.id];
    if (typeof value !== 'string') continue;
    const normalized = normalizeChord(value);
    if (normalized) out[cmd.id] = normalized;
  }
  return out;
}

export function effectiveBindings(overrides) {
  const out = {};
  for (const cmd of COMMANDS) {
    const value = overrides ? overrides[cmd.id] : null;
    out[cmd.id] = normalizeChord(value) || cmd.defaultChord;
  }
  return out;
}

function persist(overrides, storage) {
  const store = storage || defaultStorage();
  if (!store) return overrides;
  try {
    if (Object.keys(overrides).length === 0) store.removeItem(KEYBINDINGS_STORAGE_KEY);
    else store.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    return overrides;
  }
  return overrides;
}

export function saveBinding(id, chord, storage) {
  const cmd = COMMANDS.find((c) => c.id === id);
  const normalized = normalizeChord(chord);
  if (!cmd || !normalized) return loadBindings(storage);
  const next = { ...loadBindings(storage) };
  if (normalized === cmd.defaultChord) delete next[id];
  else next[id] = normalized;
  return persist(next, storage);
}

export function resetBinding(id, storage) {
  const next = { ...loadBindings(storage) };
  delete next[id];
  return persist(next, storage);
}

export function resetBindings(storage) {
  const store = storage || defaultStorage();
  if (store) {
    try {
      store.removeItem(KEYBINDINGS_STORAGE_KEY);
    } catch {
      return {};
    }
  }
  return {};
}

export function findConflict(bindings, chord, exceptId) {
  const target = normalizeChord(chord);
  if (!target || !bindings) return null;
  for (const cmd of COMMANDS) {
    if (cmd.id === exceptId) continue;
    const bound = bindings[cmd.id];
    if (bound && normalizeChord(bound) === target) return cmd.id;
  }
  return null;
}

export function findFixedShortcut(chord) {
  const target = normalizeChord(chord);
  if (!target) return null;
  return FIXED_SHORTCUTS.find((f) => f.chord === target) || null;
}
