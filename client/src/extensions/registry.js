




















import { formatMarkdownTables } from './markdownTables';
import { generateTypes } from './jsonToTs';

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
  {
    id: 'format-tools',
    name: 'Format Tools',
    description:
      "Runs the editor's built-in formatter on the active document via the command palette.",
    version: '1.0.0',
    icon: 'Wand2',
  },
  {
    id: 'markdown-table',
    name: 'Markdown Table Formatter',
    description:
      'Aligns and pads GitHub-style Markdown tables in the active .md file, preserving alignment.',
    version: '1.0.0',
    icon: 'Table2',
  },
  {
    id: 'todo-panel',
    name: 'TODO Explorer',
    description:
      'Lists every TODO / FIXME / HACK / NOTE in the project in a navigable panel.',
    version: '1.0.0',
    icon: 'ListTodo',
  },
  {
    id: 'json-to-ts',
    name: 'JSON to TypeScript',
    description:
      'Generates TypeScript interfaces (.types.ts) from the active .json file.',
    version: '1.0.0',
    icon: 'FileCode2',
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
     
  }
  try {
    window.dispatchEvent(new Event('synapse:extensions-changed'));
  } catch {
     
  }
}

export function extToast(message, kind = 'info') {
  try {
    window.dispatchEvent(
      new CustomEvent('synapse:ext-toast', { detail: { message, kind } })
    );
  } catch {
     
  }
}

 
 
 

const TODO_PATTERN = /\b(TODO|FIXME|HACK|NOTE)\b/;

let todoHighlightsOn = false;

export function isTodoHighlightsOn() {
  return todoHighlightsOn;
}








export function scanTodos(files, cap = 200) {
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
          fileName: f.name,
          line: i + 1,
          kind: m[1] === 'FIXME' ? 'fixme' : 'todo',
          text: lines[i].trim().slice(0, 200),
        });
        if (items.length >= cap) return items;
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
     
  }
}

export function toggleTodoHighlights(ctx) {
  todoHighlightsOn = !todoHighlightsOn;
  if (todoHighlightsOn) {
    const items = scanTodos(ctx?.files, 300);
    dispatchDecorations(items.map(({ fileId, line, kind }) => ({ fileId, line, kind })));
    extToast(`Highlighted ${items.length} TODOs`, 'info');
  } else {
    dispatchDecorations([]);
  }
  return todoHighlightsOn;
}

 
 
 

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

 
 
 

function openMarkdownPreview(ctx) {
  const f = ctx?.activeFile;
  if (!f || !f.name.endsWith('.md')) {
    extToast('Open a .md file first', 'info');
    return;
  }
  try {
    window.dispatchEvent(new Event('synapse:ext-open-markdown'));
  } catch {
     
  }
}

 
 
 

function wordCountToast(ctx) {
  const content = ctx?.activeFile?.content || '';
  const words = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = content.length;
  const lines = content ? content.split('\n').length : 0;
  extToast(`${words} words · ${chars} chars · ${lines} lines`, 'info');
}

 
 
 

function formatMdTables(ctx) {
  const f = ctx?.activeFile;
  if (!f || !String(f.name || '').endsWith('.md')) {
    extToast('Open a .md file first', 'info');
    return;
  }
  try {
    const { text, count } = formatMarkdownTables(f.content || '');
    if (count === 0) {
      extToast('No tables found', 'info');
      return;
    }
    ctx.updateContent(f.id, text);
    extToast(`Formatted ${count} table${count === 1 ? '' : 's'}`, 'success');
  } catch (e) {
    extToast(`Table format error: ${String((e && e.message) || e).slice(0, 80)}`, 'error');
  }
}

 
 
 

function openTodoPanel(ctx) {
  const items = scanTodos(ctx?.files, 200);
  if (!items.length) {
    extToast('No TODOs found', 'info');
    return;
  }
  try {
    window.dispatchEvent(
      new CustomEvent('synapse:ext-open-todos', { detail: { items } })
    );
  } catch {
     
  }
}

 
 
 

function pascalCaseBase(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  const parts = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const s = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (!s) return 'Root';
  return /^[0-9]/.test(s) ? 'Type' + s : s;
}

function jsonToTsCommand(ctx) {
  const f = ctx?.activeFile;
  if (!f || !String(f.name || '').endsWith('.json')) {
    extToast('Open a .json file first', 'info');
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(f.content || '');
  } catch (e) {
    extToast(`JSON error: ${String((e && e.message) || e).slice(0, 80)}`, 'error');
    return;
  }
  const newName = f.name.replace(/\.json$/i, '.types.ts');
  const exists = (ctx?.files || []).some(
    (x) => x && x.type !== 'folder' && x.parentId === f.parentId && x.name === newName
  );
  if (exists) {
    extToast(`${newName} already exists`, 'info');
    return;
  }
  let code;
  try {
    code = generateTypes(parsed, pascalCaseBase(f.name));
  } catch (e) {
    extToast(`Type generation failed: ${String((e && e.message) || e).slice(0, 80)}`, 'error');
    return;
  }
  try {
    if (typeof ctx?.createFile !== 'function') throw new Error('createFile unavailable');
    const id = ctx.createFile(newName, f.parentId ?? null);
    ctx.updateContent(id, code);
    extToast(`Created ${newName}`, 'success');
  } catch (e) {
    extToast(`Create failed: ${String((e && e.message) || e).slice(0, 80)}`, 'error');
  }
}

 
 
 






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

  if (isExtensionEnabled('format-tools')) {
    cmds.push({
      key: 'ext-format-document',
      label: 'Format Document',
      hint: ctx?.activeFile?.name || 'no file open',
      run: () => {
        try {
          window.dispatchEvent(new Event('synapse:format-document'));
        } catch {
           
        }
      },
    });
  }

  if (isExtensionEnabled('markdown-table')) {
    cmds.push({
      key: 'ext-md-tables',
      label: 'Markdown: Format Tables',
      hint: 'extensions',
      run: () => formatMdTables(ctx),
    });
  }

  if (isExtensionEnabled('todo-panel')) {
    cmds.push({
      key: 'ext-todo-list',
      label: 'TODO: List All in Panel',
      hint: 'extensions',
      run: () => openTodoPanel(ctx),
    });
  }

  if (isExtensionEnabled('json-to-ts')) {
    cmds.push({
      key: 'ext-json-to-ts',
      label: 'JSON: Generate .types.ts',
      hint: 'extensions',
      run: () => jsonToTsCommand(ctx),
    });
  }

  return cmds;
}
