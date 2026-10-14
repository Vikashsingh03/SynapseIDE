/**
 * Synapse Extensions registry (React-free — safe to import from anywhere).
 *
 * Extensions are built-in mini-plugins. Each entry in EXTENSIONS declares
 * an id/name/description/version and the lucide icon NAME to render in the
 * gallery (the panel maps names -> icon components).
 *
 * Enable/disable state lives in localStorage under 'synapse-extensions-enabled'
 * (JSON { id: bool }, default true). getExtensionCommands(ctx) builds the
 * palette commands ONLY from enabled extensions; ctx = { files, activeFile,
 * openTab, updateContent } supplied by the CommandPalette.
 *
 * Cross-component bridges (window events):
 *   - 'synapse:ext-decorations'  CustomEvent { extensionId, items } — editor
 *     decorations bridge (items: [] clears)
 *   - 'synapse:ext-open-markdown' Event — opens the markdown preview drawer
 *   - 'synapse:ext-toast'        CustomEvent { message, kind } — toast stack
 *   - 'synapse:extensions-changed' Event — gallery / palette refresh signal
 */

export const EXTENSIONS = [
  {
    id: 'todo-highlighter',
    name: 'TODO Highlighter',
    description:
      'Scans your project for TODO / FIXME / HACK / NOTE comments and highlights their lines in the editor.',
    version: '1.0.0',
    icon: 'Highlighter',
  },
  {
    id: 'json-tools',
    name: 'JSON Tools',
    description:
      'Format, minify and validate the active .json file straight from the command palette.',
    version: '1.0.0',
    icon: 'Braces',
  },
  {
    id: 'markdown-preview',
    name: 'Markdown Preview',
    description:
      'Renders the active .md file in a live side preview drawer, updated as you type.',
    version: '1.0.0',
    icon: 'BookOpen',
  },
  {
    id: 'word-counter',
    name: 'Word Counter',
    description:
      'Shows word, character and line counts for the active file in a toast.',
    version: '1.0.0',
    icon: 'WholeWord',
  },
];

const STORE_KEY = 'synapse-extensions-enabled';

function readEnabledMap() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isExtensionEnabled(id) {
  const map = readEnabledMap();
  return map[id] === undefined ? true : !!map[id];
}

export function setExtensionEnabled(id, enabled) {
  const map = readEnabledMap();
  map[id] = !!enabled;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — state just won't persist */
  }
  try {
    window.dispatchEvent(new Event('synapse:extensions-changed'));
  } catch {
    /* no window in tests */
  }
}

export function extToast(message, kind = 'info') {
  try {
    window.dispatchEvent(
      new CustomEvent('synapse:ext-toast', { detail: { message, kind } })
    );
  } catch {
    /* no window in tests */
  }
}

/* ------------------------------------------------------------------ */
/* todo-highlighter                                                    */
/* ------------------------------------------------------------------ */

const TODO_PATTERN = /\b(TODO|FIXME|HACK|NOTE)\b/;
const TODO_CAP = 300;

let todoHighlightsOn = false;

export function isTodoHighlightsOn() {
  return todoHighlightsOn;
}

function scanTodoItems(files) {
  const items = [];
  for (const f of files || []) {
    if (!f || f.type === 'folder') continue;
    const content = f.content || '';
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(TODO_PATTERN);
      if (m) {
        items.push({
          fileId: f.id,
          line: i + 1,
          kind: m[1] === 'FIXME' ? 'fixme' : 'todo',
        });
        if (items.length >= TODO_CAP) return items;
      }
    }
  }
  return items;
}

function dispatchDecorations(items) {
  try {
    window.dispatchEvent(
      new CustomEvent('synapse:ext-decorations', {
        detail: { extensionId: 'todo-highlighter', items },
      })
    );
  } catch {
    /* no window in tests */
  }
}

export function toggleTodoHighlights(ctx) {
  todoHighlightsOn = !todoHighlightsOn;
  if (todoHighlightsOn) {
    const items = scanTodoItems(ctx?.files);
    dispatchDecorations(items);
    extToast(`Highlighted ${items.length} TODOs`, 'info');
  } else {
    dispatchDecorations([]);
  }
  return todoHighlightsOn;
}

/* ------------------------------------------------------------------ */
/* json-tools                                                          */
/* ------------------------------------------------------------------ */

function jsonCommand(ctx, op) {
  const f = ctx?.activeFile;
  if (!f || !f.name.endsWith('.json')) {
    extToast('Open a .json file first', 'info');
    return;
  }
  try {
    const parsed = JSON.parse(f.content || '');
    if (op === 'format') {
      ctx.updateContent(f.id, JSON.stringify(parsed, null, 2));
      extToast('JSON formatted', 'success');
    } else if (op === 'minify') {
      ctx.updateContent(f.id, JSON.stringify(parsed));
      extToast('JSON minified', 'success');
    } else {
      extToast('Valid JSON', 'success');
    }
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 80);
    extToast(`JSON error: ${msg}`, 'error');
  }
}

/* ------------------------------------------------------------------ */
/* markdown-preview                                                    */
/* ------------------------------------------------------------------ */

function openMarkdownPreview(ctx) {
  const f = ctx?.activeFile;
  if (!f || !f.name.endsWith('.md')) {
    extToast('Open a .md file first', 'info');
    return;
  }
  try {
    window.dispatchEvent(new Event('synapse:ext-open-markdown'));
  } catch {
    /* no window in tests */
  }
}

/* ------------------------------------------------------------------ */
/* word-counter                                                        */
/* ------------------------------------------------------------------ */

function wordCountToast(ctx) {
  const content = ctx?.activeFile?.content || '';
  const words = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = content.length;
  const lines = content ? content.split('\n').length : 0;
  extToast(`${words} words · ${chars} chars · ${lines} lines`, 'info');
}

/* ------------------------------------------------------------------ */
/* command builder                                                     */
/* ------------------------------------------------------------------ */

/**
 * Palette-ready commands built ONLY from enabled extensions.
 * Each item: { key, label, hint, run }. The palette maps these to its own
 * item shape (adds a generic icon + closes the palette on run).
 */
export function getExtensionCommands(ctx) {
  const cmds = [];

  if (isExtensionEnabled('todo-highlighter')) {
    cmds.push({
      key: 'ext-todo-toggle',
      label: 'TODO: Toggle Highlights',
      hint: 'extensions',
      run: () => toggleTodoHighlights(ctx),
    });
  }

  if (isExtensionEnabled('json-tools')) {
    cmds.push(
      {
        key: 'ext-json-format',
        label: 'JSON: Format',
        hint: 'extensions',
        run: () => jsonCommand(ctx, 'format'),
      },
      {
        key: 'ext-json-minify',
        label: 'JSON: Minify',
        hint: 'extensions',
        run: () => jsonCommand(ctx, 'minify'),
      },
      {
        key: 'ext-json-validate',
        label: 'JSON: Validate',
        hint: 'extensions',
        run: () => jsonCommand(ctx, 'validate'),
      }
    );
  }

  if (isExtensionEnabled('markdown-preview')) {
    cmds.push({
      key: 'ext-markdown-preview',
      label: 'Markdown: Open Preview',
      hint: 'extensions',
      run: () => openMarkdownPreview(ctx),
    });
  }

  if (isExtensionEnabled('word-counter')) {
    cmds.push({
      key: 'ext-word-count',
      label: 'Word Count',
      hint: 'extensions',
      run: () => wordCountToast(ctx),
    });
  }

  return cmds;
}
