// Prettier formatting for Synapse (Wave 6).
// REAL Prettier (what VS Code users actually run) instead of Monaco's
// built-in formatter, for JS/JSX/TS/TSX/JSON/CSS/HTML.
// Everything here is lazy: prettier is loaded via dynamic import ONLY when
// the first format runs, so it lands in its own Vite chunk (~1.5-2MB) and
// never in the main bundle. In the Node unit-test harness the same module
// is bundled with esbuild against a scratch prettier install.

let loading = null;

// Normalize plugin modules across bundler interop shapes:
// prettier's docs use `import * as plugin from 'prettier/plugins/babel'`
// and pass the namespace object; the CJS builds expose the same shape on
// `.default`. Either works — take whichever carries `parsers`.
function normPlugin(m) {
  if (!m) return null;
  if (m.parsers) return m;
  if (m.default && m.default.parsers) return m.default;
  return m;
}

export async function loadPrettier() {
  if (!loading) {
    loading = (async () => {
      const [prettier, babel, estree, typescript, html, postcss] = await Promise.all([
        import('prettier/standalone'),
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
        import('prettier/plugins/typescript'),
        import('prettier/plugins/html'),
        import('prettier/plugins/postcss'),
      ]);
      const format = prettier.format || (prettier.default && prettier.default.format);
      if (typeof format !== 'function') throw new Error('prettier.format not found');
      return {
        format,
        babel: normPlugin(babel),
        estree: normPlugin(estree),
        typescript: normPlugin(typescript),
        html: normPlugin(html),
        postcss: normPlugin(postcss),
      };
    })().catch((err) => {
      loading = null; // let a later call retry
      throw err;
    });
  }
  return loading;
}

// extension -> { parser, pluginKeys }. postcss plugin's parser is named 'css'
// and handles css/scss/less.
function parserFor(fileName) {
  if (typeof fileName !== 'string') return null;
  const base = fileName.split(/[\\/]/).pop().toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = base.slice(dot + 1);
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext))
    return { parser: 'babel', plugins: ['babel', 'estree', 'typescript'] };
  if (['ts', 'tsx', 'mts', 'cts'].includes(ext))
    return { parser: 'typescript', plugins: ['babel', 'estree', 'typescript'] };
  if (ext === 'json') return { parser: 'json', plugins: ['babel', 'estree'] };
  if (['css', 'scss', 'less'].includes(ext)) return { parser: 'css', plugins: ['postcss'] };
  if (ext === 'html') return { parser: 'html', plugins: ['html'] };
  return null;
}

function relPathOf(file, files) {
  if (!file) return '';
  const parts = [file.name];
  let cur = file;
  const seen = new Set([cur.id]);
  while (cur && cur.parentId != null) {
    const p = (files || []).find((f) => f.id === cur.parentId);
    if (!p || seen.has(p.id)) break;
    seen.add(p.id);
    parts.unshift(p.name);
    cur = p;
  }
  return parts.join('/');
}

const KNOWN_KEYS = [
  'semi',
  'singleQuote',
  'tabWidth',
  'useTabs',
  'trailingComma',
  'printWidth',
  'bracketSpacing',
  'arrowParens',
  'endOfLine',
];

function pickKnown(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of KNOWN_KEYS) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

// Project config: root .prettierrc (JSON) wins; else package.json "prettier"
// key; else defaults. Never throws.
export function resolvePrettierOptions(files, fileName) {
  const defaults = {
    semi: true,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: 'all',
    printWidth: 100,
  };
  try {
    const list = (files || []).filter((f) => f && f.type !== 'folder');
    const rc = list.find((f) => relPathOf(f, list) === '.prettierrc');
    if (rc && typeof rc.content === 'string' && rc.content.trim()) {
      try {
        const parsed = JSON.parse(rc.content);
        return { ...defaults, ...pickKnown(parsed) };
      } catch {
        /* fall through to package.json */
      }
    }
    const pkg = list.find((f) => relPathOf(f, list) === 'package.json');
    if (pkg && typeof pkg.content === 'string') {
      try {
        const parsed = JSON.parse(pkg.content);
        const cfg = parsed && parsed.prettier;
        if (cfg && typeof cfg === 'object') return { ...defaults, ...pickKnown(cfg) };
      } catch {}
    }
  } catch {}
  return defaults;
}

// Formats `text`; returns the formatted string, or null when unsupported
// (extension, syntax error, load failure). Never throws.
export async function formatWithPrettier(text, fileName, files = []) {
  try {
    if (typeof text !== 'string' || !text.trim()) return text || '';
    const entry = parserFor(fileName);
    if (!entry) return null;
    const p = await loadPrettier();
    const pluginObjs = entry.plugins.map((k) => p[k]).filter(Boolean);
    const options = {
      ...resolvePrettierOptions(files, fileName),
      parser: entry.parser,
      plugins: pluginObjs,
    };
    const out = await p.format(text, options);
    return typeof out === 'string' ? out : null;
  } catch {
    return null;
  }
}

// Registers a Monaco DocumentFormattingEditProvider (Shift+Alt+F) for the
// supported languages, backed by formatWithPrettier. Global per language —
// guarded so repeated calls (split panels, file switches) register once.
// getFiles: () => current FileContext files array (for .prettierrc lookup).
let providerRegistered = false;
export function registerPrettierFormattingProvider(monaco, getFiles) {
  try {
    if (providerRegistered || !monaco?.languages?.registerDocumentFormattingEditProvider)
      return false;
    providerRegistered = true;
    const nameFromModel = (model) => {
      try {
        const path = model?.uri?.path || '';
        return decodeURIComponent(path.split('/').pop() || '');
      } catch {
        return '';
      }
    };
    for (const lang of ['javascript', 'typescript', 'json', 'css', 'html']) {
      monaco.languages.registerDocumentFormattingEditProvider(lang, {
        async provideDocumentFormattingEdits(model) {
          try {
            const text = model.getValue();
            const out = await formatWithPrettier(text, nameFromModel(model), getFiles?.() || []);
            if (out && out !== text) return [{ range: model.getFullModelRange(), text: out }];
          } catch {}
          return [];
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}
