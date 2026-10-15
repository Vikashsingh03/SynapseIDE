







let loading = null;





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
      loading = null; 
      throw err;
    });
  }
  return loading;
}



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
