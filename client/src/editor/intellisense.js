




















let registered = false;





const REACT_STUB_DTS = `declare module 'react' {
  export type ReactNode = any;
  export type FC<P = {}> = (props: P) => any;
  export type ComponentType<P = {}> = (props: P) => any;
  export type ChangeEvent<T = any> = any;
  export type FormEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
  export type KeyboardEvent<T = any> = any;
  export type FocusEvent<T = any> = any;
  export type SyntheticEvent<T = any> = any;
  export type Ref<T = any> = any;
  export type RefObject<T = any> = any;
  export type MutableRefObject<T = any> = any;
  export type Dispatch<A = any> = (value: A) => void;
  export type SetStateAction<S = any> = any;
  export type CSSProperties = any;
  export type HTMLAttributes<T = any> = any;
  export type ButtonHTMLAttributes<T = any> = any;
  export type InputHTMLAttributes<T = any> = any;
  export type EffectCallback = () => (void | (() => void | undefined));
  export type DependencyList = any[];
  export type Reducer<S = any, A = any> = (prevState: S, action: A) => S;
  export function useState<S = any>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useRef<T = any>(initialValue: T): MutableRefObject<T>;
  export function useMemo<T = any>(factory: () => T, deps: DependencyList | undefined): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T;
  export function useContext<T = any>(context: Context<T>): T;
  export function useReducer<R extends Reducer<any, any>>(reducer: R, initialArg: any, init?: any): [any, Dispatch];
  export function useId(): string;
  export function useTransition(): [boolean, (callback: () => void) => void];
  export function useDeferredValue<T = any>(value: T): T;
  export interface Context<T = any> { Provider: any; Consumer: any; displayName?: string; }
  export function createContext<T = any>(defaultValue: T): Context<T>;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export function cloneElement(element: any, props?: any, ...children: any[]): any;
  export function memo<P = any>(component: ComponentType<P>, propsAreEqual?: any): ComponentType<P>;
  export function forwardRef<T = any, P = any>(render: (props: P, ref: Ref<T>) => any): ComponentType<P>;
  export function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): T;
  export const Fragment: any;
  export const StrictMode: any;
  export const Suspense: any;
  export default any;
}

declare module 'react-dom/client' {
  export interface Root { render(children: any): void; unmount(): void; }
  export function createRoot(container: any): Root;
  export function hydrateRoot(container: any, children: any): Root;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export const Fragment: any;
}
`;

const EXTRA_LIBS = [
  { path: 'file:///node_modules/@types/react/index.d.ts', content: REACT_STUB_DTS },
  {
    path: 'file:///node_modules/@types/react-dom/client.d.ts',
    content: `declare module 'react-dom/client' {
  export interface Root { render(children: any): void; unmount(): void; }
  export function createRoot(container: any): Root;
  export function hydrateRoot(container: any, children: any): Root;
}
`,
  },
  {
    path: 'file:///node_modules/@types/react/jsx-runtime.d.ts',
    content: `declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export const Fragment: any;
}
`,
  },
];

function setupJsTs(monaco) {
  const ts = monaco?.languages?.typescript;
  const defaults = [ts?.javascriptDefaults, ts?.typescriptDefaults].filter(Boolean);
  if (!defaults.length) return;

  const compilerOptions = {
    target: ts?.ScriptTarget?.ESNext,
    moduleResolution: ts?.ModuleResolution?.NodeJs,
    module: ts?.ModuleKind?.ESNext,
    jsx: ts?.JsxEmit?.ReactJSX ?? 2,
    allowJs: true,
    allowNonTsExtensions: true,
    checkJs: false,
    noEmit: true,
    esModuleInterop: true,
  };

  for (const d of defaults) {
    try {
      d.setCompilerOptions?.(compilerOptions);
    } catch {
       
    }
    for (const lib of EXTRA_LIBS) {
      try {
        d.addExtraLib?.(lib.content, lib.path);
      } catch {
         
      }
    }
  }
}





const SPACING_SCALE = [
  '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9',
  '10', '11', '12', '14', '16', '20', '24',
];
const SPACING_PREFIXES = [
  'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr',
  'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr',
  'gap', 'space-x', 'space-y',
];
const FRACTIONS = [
  '1/2', '1/3', '2/3', '1/4', '2/4', '3/4', '1/5', '2/5', '3/5', '4/5',
  '1/6', '5/6', '1/12', '5/12', '7/12', '11/12',
];
const SIZE_WORDS = ['full', 'screen', 'auto', 'min', 'max', 'fit'];
const TEXT_SIZES = [
  'xs', 'sm', 'base', 'lg', 'xl',
  '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
];
const FONT_WEIGHTS = [
  'font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium',
  'font-semibold', 'font-bold', 'font-extrabold', 'font-black',
];
const COLOR_NAMES = [
  'slate', 'gray', 'zinc', 'red', 'orange', 'amber', 'yellow', 'green',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
  'pink', 'rose',
];
const COLOR_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const COLOR_PREFIXES = ['bg', 'text', 'border', 'ring', 'from', 'via', 'to'];

const COLOR_HEX = {
  slate: '#64748b', gray: '#6b7280', zinc: '#71717a', red: '#ef4444',
  orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', green: '#22c55e',
  emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7',
  pink: '#ec4899', rose: '#f43f5e',
};
const COLOR_WORDS = ['bg-black', 'bg-white', 'bg-transparent', 'bg-current',
  'text-black', 'text-white', 'text-transparent', 'text-current',
  'border-black', 'border-white', 'border-transparent', 'border-current'];

const LAYOUT_UTILS = [
  'flex', 'inline-flex', 'grid', 'inline-grid', 'block', 'inline-block',
  'inline', 'hidden', 'contents', 'flow-root',
  'relative', 'absolute', 'fixed', 'sticky', 'static',
  'flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse',
  'flex-wrap', 'flex-wrap-reverse', 'flex-nowrap',
  'items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch',
  'justify-start', 'justify-end', 'justify-center', 'justify-between',
  'justify-around', 'justify-evenly',
  'content-start', 'content-end', 'content-center', 'content-between',
  'content-around', 'content-evenly',
  'self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch',
  'self-baseline',
  'place-items-start', 'place-items-end', 'place-items-center',
  'place-items-stretch', 'place-content-start', 'place-content-end',
  'place-content-center', 'place-content-between',
  'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl',
  'rounded-2xl', 'rounded-3xl', 'rounded-full', 'rounded-none',
  'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl',
  'shadow-2xl', 'shadow-inner', 'shadow-none',
  'border', 'border-0', 'border-2', 'border-4', 'border-8',
  'border-x', 'border-y', 'border-t', 'border-r', 'border-b', 'border-l',
  'border-solid', 'border-dashed', 'border-dotted', 'border-double', 'border-none',
  'cursor-pointer', 'cursor-default', 'cursor-not-allowed', 'cursor-wait',
  'select-none', 'select-text', 'select-all',
  'overflow-auto', 'overflow-hidden', 'overflow-visible', 'overflow-scroll',
  'overflow-x-auto', 'overflow-x-hidden', 'overflow-y-auto', 'overflow-y-hidden',
  'truncate', 'uppercase', 'lowercase', 'capitalize', 'normal-case',
  'italic', 'not-italic', 'underline', 'overline', 'line-through', 'no-underline',
  'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide',
  'tracking-wider', 'tracking-widest',
  'leading-none', 'leading-tight', 'leading-snug', 'leading-normal',
  'leading-relaxed', 'leading-loose',
  'max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl',
  'max-w-3xl', 'max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl',
  'max-w-full', 'max-w-screen-sm', 'max-w-screen-md', 'max-w-screen-lg',
  'min-h-0', 'min-h-full', 'min-h-screen', 'min-w-0', 'min-w-full',
  'min-w-min', 'min-w-max', 'min-w-fit',
  'object-contain', 'object-cover', 'object-fill', 'object-none',
  'transition', 'transition-all', 'transition-colors', 'transition-opacity',
  'transition-transform', 'ease-linear', 'ease-in', 'ease-out', 'ease-in-out',
];

const TAILWIND_LANGS = ['css', 'html', 'javascriptreact', 'typescriptreact', 'javascript', 'typescript'];
const TAILWIND_TRIGGERS = [' ', '"', "'", '@'];
const TOKEN_CHAR = /[a-zA-Z0-9\-_:/.[\]%#]/;

const CLASS_ATTR_RE = /(class|className)\s*=\s*(\{|"[^"]*|'[^']*|`[^`]*)$/;

function buildTailwindItems(monaco) {
  const kinds = monaco?.languages?.CompletionItemKind || {};
  const valueKind = kinds.Value ?? 1;
  const colorKind = kinds.Color ?? valueKind;
  const seen = new Set();
  const items = [];

  const push = (label, { kind = valueKind, documentation = '' } = {}) => {
    if (seen.has(label)) return;
    seen.add(label);
    items.push({
      label,
      kind,
      detail: 'tailwind',
      documentation,
      sortText: '2-' + label,
      insertText: label,
    });
  };

  
  for (const prefix of SPACING_PREFIXES) {
    for (const s of SPACING_SCALE) push(`${prefix}-${s}`);
  }
  
  for (const prefix of ['w', 'h']) {
    for (const f of FRACTIONS) push(`${prefix}-${f}`);
    for (const s of SPACING_SCALE) push(`${prefix}-${s}`);
    for (const w of SIZE_WORDS) push(`${prefix}-${w}`);
  }
  push('w-screen', {}); 
  push('h-screen', {});
  
  for (const s of TEXT_SIZES) push(`text-${s}`);
  for (const w of FONT_WEIGHTS) push(w);
  
  for (const prefix of COLOR_PREFIXES) {
    for (const color of COLOR_NAMES) {
      for (const shade of COLOR_SHADES) {
        push(`${prefix}-${color}-${shade}`, {
          kind: colorKind,
          documentation: `${prefix} · ${color}-${shade} · ${COLOR_HEX[color]} (500)`,
        });
      }
    }
  }
  for (const c of COLOR_WORDS) {
    push(c, { kind: colorKind, documentation: 'tailwind color keyword' });
  }
  
  for (const z of ['0', '10', '20', '30', '40', '50']) push(`z-${z}`);
  for (let i = 1; i <= 12; i++) push(`order-${i}`);
  push('order-first'); push('order-last'); push('order-none');
  for (const d of ['75', '100', '150', '200', '300', '500', '700', '1000']) push(`duration-${d}`);
  for (const o of ['0', '5', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '90', '95', '100']) push(`opacity-${o}`);
  for (let i = 1; i <= 12; i++) push(`col-span-${i}`);
  push('col-span-full');
  for (let i = 1; i <= 6; i++) push(`row-span-${i}`);
  push('row-span-full');
  
  for (const u of LAYOUT_UTILS) push(u);

  
  return items.slice(0, 2500);
}

function computeTailwindRange(model, position) {
  const line = model.getLineContent(position.lineNumber);
  let start = position.column - 1;
  while (start > 0 && TOKEN_CHAR.test(line[start - 1])) start--;
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: start + 1,
    endColumn: position.column,
  };
}

function shouldOfferTailwind(model, position) {
  const lang = model.getLanguageId();
  if (!TAILWIND_LANGS.includes(lang)) return false;
  const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  if (lang === 'css') {
    
    return prefix.includes('@apply') || prefix.trim().startsWith('.');
  }
  
  return CLASS_ATTR_RE.test(prefix);
}

function setupTailwind(monaco) {
  const register = monaco?.languages?.registerCompletionItemProvider;
  if (typeof register !== 'function') return;
  const items = buildTailwindItems(monaco);

  register(TAILWIND_LANGS, {
    triggerCharacters: TAILWIND_TRIGGERS,
    provideCompletionItems(model, position) {
      try {
        if (!shouldOfferTailwind(model, position)) {
          return { suggestions: [] };
        }
        const range = computeTailwindRange(model, position);
        return {
          suggestions: items.map((item) => ({ ...item, range })),
        };
      } catch {
        return { suggestions: [] };
      }
    },
  });
}





function setupJson(monaco) {
  try {
    monaco?.languages?.json?.jsonDefaults?.setDiagnosticsOptions?.({
      validate: true,
      allowComments: true,
      schemas: [
        {
          uri: 'https://synapse.local/schemas/package.json',
          fileMatch: ['package.json'],
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              private: { type: 'boolean' },
              type: { enum: ['module', 'commonjs'] },
              main: { type: 'string' },
              scripts: { type: 'object' },
              dependencies: { type: 'object' },
              devDependencies: { type: 'object' },
              workspaces: { type: 'array' },
            },
          },
        },
      ],
    });
  } catch {
     
  }
}
























const PROJECT_LIB_ELIGIBLE_RE = /\.(?:d\.ts|ts|tsx|mts|cts|js|jsx)$/;
const MAX_PROJECT_LIB_BYTES = 200 * 1024;
const PROJECT_SYNC_DEBOUNCE_MS = 400;

function relPathOfFile(file, files) {
  const byId = new Map();
  for (const f of files || []) {
    if (f && f.id != null) byId.set(f.id, f);
  }
  const parts = [];
  const seen = new Set();
  let cur = file;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name || 'untitled');
    cur = cur.parentId != null ? byId.get(cur.parentId) : null;
  }
  return parts.join('/');
}

function uriForRelPath(relPath) {
  return (
    'file:///' +
    String(relPath)
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
  );
}



export function contentSignature(content) {
  const n = content.length;
  let h = 5381;
  for (let i = 0; i < n; i += 97) {
    h = ((h << 5) + h + content.charCodeAt(i)) >>> 0;
  }
  return n + ':' + h.toString(36) + ':' + content.slice(0, 50) + '|' + content.slice(-50);
}


export function projectLibsForFiles(files) {
  const desired = new Map();
  for (const f of files || []) {
    if (!f || f.type === 'folder') continue;
    const name = f.name || '';
    if (!PROJECT_LIB_ELIGIBLE_RE.test(name)) continue;
    const content = typeof f.content === 'string' ? f.content : '';
    if (content.length > MAX_PROJECT_LIB_BYTES) continue;
    const uri = uriForRelPath(relPathOfFile(f, files));
    if (desired.has(uri)) continue; 
    desired.set(uri, content);
  }
  return desired;
}

function addLibToDefaults(defaults, content, uri) {
  const disposables = [];
  for (const d of defaults) {
    try {
      const disp = d && d.addExtraLib ? d.addExtraLib(content, uri) : null;
      if (disp) disposables.push(disp);
    } catch {
       
    }
  }
  return {
    dispose() {
      for (const disp of disposables) {
        try {
          disp.dispose && disp.dispose();
        } catch {
           
        }
      }
    },
    
    count: disposables.length,
  };
}


export function createSyncer(defaults) {
  const live = new Map(); 
  return {
    sync(desired) {
      try {
        for (const [uri, entry] of Array.from(live)) {
          if (!desired.has(uri)) {
            try {
              entry.disposable && entry.disposable.dispose();
            } catch {}
            live.delete(uri);
          }
        }
        for (const [uri, content] of desired) {
          const sig = contentSignature(content);
          const entry = live.get(uri);
          if (!entry) {
            const disposable = addLibToDefaults(defaults, content, uri);
            
            
            if (disposable.count > 0) live.set(uri, { sig, disposable });
          } else if (entry.sig !== sig) {
            try {
              entry.disposable && entry.disposable.dispose();
            } catch {}
            const disposable = addLibToDefaults(defaults, content, uri);
            if (disposable.count > 0) live.set(uri, { sig, disposable });
            else live.delete(uri);
          }
        }
      } catch {
         
      }
    },
    uris() {
      return Array.from(live.keys());
    },
    size() {
      return live.size;
    },
  };
}

function typescriptDefaultsFor(monaco) {
  const ts = monaco && monaco.languages && monaco.languages.typescript;
  return [ts && ts.javascriptDefaults, ts && ts.typescriptDefaults].filter(Boolean);
}



export function createProjectSync(monaco, opts) {
  const syncer = createSyncer(typescriptDefaultsFor(monaco));
  const debounceMs =
    opts && typeof opts.debounceMs === 'number' ? opts.debounceMs : PROJECT_SYNC_DEBOUNCE_MS;
  let timer = null;
  const applyNow = (files) => {
    try {
      syncer.sync(projectLibsForFiles(files));
    } catch {}
  };
  return {
    sync(files) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        applyNow(files);
      }, debounceMs);
    },
    flush(files) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      applyNow(files);
    },
    uris: () => syncer.uris(),
    size: () => syncer.size(),
  };
}

let projectSyncSingleton = null;

export function syncProjectFiles(monaco, files) {
  try {
    if (!projectSyncSingleton) {
      projectSyncSingleton = createProjectSync(monaco);
    }
    projectSyncSingleton.sync(files);
  } catch {
     
  }
}



export function registerIntellisense(monaco) {
  if (registered) return;
  registered = true;
  try {
    setupJsTs(monaco);
  } catch {
     
  }
  try {
    setupTailwind(monaco);
  } catch {
     
  }
  try {
    setupJson(monaco);
  } catch {
     
  }
}
