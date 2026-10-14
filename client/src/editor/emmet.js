// Emmet abbreviation expansion for Synapse's Monaco editor.
//
// Pure, dependency-free ESM. Two public expanders:
//   expandEmmet(abbr)    -> HTML snippet string (with a single $0 tabstop), or null
//   expandEmmetJsx(abbr) -> same, but class->className, for->htmlFor (voids self-close)
// plus registerEmmet(editor, monaco) which wires a smart Tab keybinding.
//
// Supported subset:
//   tags (incl. custom like my-card), implicit div for bare .class / #id
//   .class (repeatable), #id, [attr] / [attr=value] / [attr="quoted value"]
//   {text}, child >, sibling +, climb-up ^, multiplication *n,
//   $ / $$ numbering (in tag, classes, id, attrs, text), (grouping) with *n,
//   void elements, default attrs (a/img/input/link/form), input :pseudo types.
//
// Returns null for: empty string, lone bare tag name (pure text), spaces
// outside {} / [], CSS-like input (':' or ';' outside []/{}), unbalanced
// parens/brackets, and pseudo-classes on non-input elements.

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const INPUT_TYPES = new Set([
  'text', 'password', 'email', 'number', 'search', 'tel', 'url',
  'checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'image',
  'hidden', 'date', 'time', 'datetime-local', 'month', 'week',
  'color', 'range',
]);

const DEFAULT_ATTRS = {
  a: [['href', '']],
  img: [['src', ''], ['alt', '']],
  input: [['type', 'text']],
  link: [['rel', 'stylesheet'], ['href', '']],
  form: [['action', '']],
};

// '$$' -> zero-padded to the run length: '$' -> '1', '$$' -> '01', '$$$' -> '001'
function substitute(str, idx) {
  return String(str).replace(/\${1,}/g, (m) => String(idx).padStart(m.length, '0'));
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

class Parser {
  constructor(s) {
    this.s = s;
    this.i = 0;
  }
  get done() { return this.i >= this.s.length; }
  peek() { return this.s[this.i]; }
  fail() { throw new Error('invalid abbreviation'); }
  isNameStart(ch) { return ch !== undefined && /[A-Za-z]/.test(ch); }
  isNameChar(ch) { return ch !== undefined && /[\w\-$]/.test(ch); }

  parse() {
    const roots = this.parseSequence(null);
    if (!this.done) this.fail();
    return roots;
  }

  // Parses nodes/groups joined by > + ^ until stopChar (')' for groups) or end.
  parseSequence(stopChar) {
    const roots = [];
    let last = null;        // last placed node
    let expectChild = false;
    let needOperand = false; // true right after > + ^ (an operand must follow)

    const place = (nodes) => {
      for (const n of nodes) {
        if (last === null) {
          n.parent = null;
          roots.push(n);
        } else if (expectChild) {
          n.parent = last;
          last.children.push(n);
        } else {
          n.parent = last.parent;
          if (last.parent) last.parent.children.push(n);
          else roots.push(n);
        }
        last = n;
      }
      expectChild = false;
    };

    while (!this.done && this.peek() !== stopChar) {
      const ch = this.peek();
      if (ch === '>' || ch === '+' || ch === '^') {
        if (last === null) this.fail();
        this.i++;
        if (ch === '>') { expectChild = true; needOperand = true; }
        else if (ch === '+') { expectChild = false; needOperand = true; }
        else {
          let ups = 1;
          while (!this.done && this.peek() === '^') { ups++; this.i++; }
          for (let k = 0; k < ups && last && last.parent; k++) last = last.parent;
          expectChild = false;
          needOperand = true;
        }
        continue;
      }
      if (needOperand === false && last !== null) this.fail(); // e.g. "div span"
      place(this.parseOperand());
      needOperand = false;
    }
    if (needOperand) this.fail(); // trailing operator like "div>"
    return roots;
  }

  parseOperand() {
    if (this.peek() === '(') return this.parseGroup();
    return [this.parseNode()];
  }

  parseGroup() {
    this.i++; // consume '('
    if (this.done || this.peek() === ')') this.fail();
    const children = this.parseSequence(')');
    if (this.done || this.peek() !== ')') this.fail();
    this.i++; // consume ')'
    let count = 1;
    if (!this.done && this.peek() === '*') count = this.parseCount();
    const group = { isGroup: true, children, count, parent: null };
    for (const c of children) c.parent = group;
    return [group];
  }

  parseNode() {
    const node = {
      tag: 'div', id: null, classes: [], attrs: [],
      text: null, pseudoType: null, count: 1, children: [], parent: null,
    };
    const ch = this.peek();
    if (ch === '.' || ch === '#' || ch === '[' || ch === '{' || ch === ':') {
      // implicit div
    } else if (this.isNameStart(ch)) {
      node.tag = this.parseTagName();
    } else {
      this.fail();
    }

    for (;;) {
      if (this.done) break;
      const c = this.peek();
      if (c === '.') { this.i++; node.classes.push(this.parseClassName()); }
      else if (c === '#') {
        this.i++;
        if (node.id !== null) this.fail();
        node.id = this.parseClassName();
      }
      else if (c === ':') {
        this.i++;
        const pseudo = this.parseTagName();
        if (node.tag === 'input') {
          if (INPUT_TYPES.has(pseudo)) node.pseudoType = pseudo;
          // other pseudos on input are skipped silently
        } else {
          this.fail(); // pseudo-class on non-input -> unsupported
        }
      }
      else if (c === '[') this.parseAttrs(node);
      else if (c === '{') {
        if (node.text !== null) this.fail();
        node.text = this.parseText();
      }
      else if (c === '*') { node.count = this.parseCount(); break; }
      else break;
    }
    return node;
  }

  parseTagName() {
    let name = '';
    while (!this.done && this.isNameChar(this.peek())) { name += this.peek(); this.i++; }
    if (!name) this.fail();
    return name;
  }

  parseClassName() {
    let name = '';
    while (!this.done && /[\w\-$]/.test(this.peek())) { name += this.peek(); this.i++; }
    if (!name) this.fail();
    return name;
  }

  parseCount() {
    this.i++; // consume '*'
    let n = '';
    while (!this.done && /[0-9]/.test(this.peek())) { n += this.peek(); this.i++; }
    const count = parseInt(n, 10);
    if (!n || Number.isNaN(count) || count < 1) this.fail();
    return count;
  }

  skipBracketSpaces() {
    while (!this.done && (this.peek() === ' ' || this.peek() === '\t')) this.i++;
  }

  parseAttrs(node) {
    this.i++; // consume '['
    for (;;) {
      this.skipBracketSpaces();
      if (this.done) this.fail();
      if (this.peek() === ']') { this.i++; return; }
      let name = '';
      while (!this.done && /[\w\-:.@]/.test(this.peek())) { name += this.peek(); this.i++; }
      if (!name) this.fail();
      this.skipBracketSpaces();
      let value = null;
      if (!this.done && this.peek() === '=') {
        this.i++;
        this.skipBracketSpaces();
        value = this.parseAttrValue();
        this.skipBracketSpaces();
      }
      node.attrs.push({ name, value });
    }
  }

  parseAttrValue() {
    const c = this.peek();
    if (c === '"' || c === "'") {
      this.i++;
      let v = '';
      while (!this.done && this.peek() !== c) { v += this.peek(); this.i++; }
      if (this.done) this.fail();
      this.i++; // closing quote
      return v;
    }
    let v = '';
    while (!this.done && this.peek() !== ' ' && this.peek() !== '\t' && this.peek() !== ']') {
      v += this.peek(); this.i++;
    }
    if (!v) this.fail();
    return v;
  }

  parseText() {
    this.i++; // consume '{'
    let t = '';
    while (!this.done && this.peek() !== '}') { t += this.peek(); this.i++; }
    if (this.done) this.fail();
    this.i++; // consume '}'
    return t;
  }
}

function renderNode(node, idx, jsx, ctx) {
  let out = '';
  const count = node.count || 1;
  for (let k = 1; k <= count; k++) out += renderOnce(node, k, jsx, ctx);
  return out;
}

function renderOnce(node, idx, jsx, ctx) {
  if (node.isGroup) {
    return node.children.map((c) => renderNode(c, idx, jsx, ctx)).join('');
  }
  const tag = substitute(node.tag, idx);
  const isVoid = VOID_ELEMENTS.has(tag.toLowerCase());
  const classes = node.classes.map((c) => substitute(c, idx));
  const id = node.id ? substitute(node.id, idx) : null;

  const attrList = [];
  const seen = new Set();
  const pushAttr = (name, value) => {
    const key = name.toLowerCase();
    const existing = attrList.find((a) => a.key === key);
    if (existing) existing.value = value;
    else { seen.add(key); attrList.push({ key, name, value }); }
  };

  for (const [n, v] of (DEFAULT_ATTRS[tag.toLowerCase()] || [])) pushAttr(n, v);
  if (node.pseudoType) pushAttr('type', node.pseudoType);
  for (const a of node.attrs) {
    const n = substitute(a.name, idx);
    const v = a.value === null ? null : substitute(a.value, idx);
    if (n.toLowerCase() === 'class' || n.toLowerCase() === 'classname') {
      if (v) classes.push(...v.split(/\s+/).filter(Boolean));
      continue;
    }
    pushAttr(n, v);
  }

  const classAttr = jsx ? 'className' : 'class';
  // Emmet attribute order: other attributes first (defaults, then explicit),
  // then id, then class.
  let attrStr = '';
  for (const a of attrList) {
    let aname = a.name;
    if (jsx && aname === 'for') aname = 'htmlFor';
    attrStr += a.value === null ? ` ${aname}` : ` ${aname}="${escapeAttr(a.value)}"`;
  }
  if (id) attrStr += ` id="${escapeAttr(id)}"`;
  if (classes.length) attrStr += ` ${classAttr}="${escapeAttr(classes.join(' '))}"`;

  const text = node.text === null ? '' : substitute(node.text, idx);
  const childrenHtml = node.children.map((c) => renderNode(c, idx, jsx, ctx)).join('');

  if (isVoid) return `<${tag}${attrStr} />`;

  // $0 goes right after the first element's text; otherwise inside the
  // first structurally-empty element; otherwise at the very end.
  let inner = text + childrenHtml;
  if (!ctx.tabstopPlaced && text !== '') {
    inner = text + '$0' + childrenHtml;
    ctx.tabstopPlaced = true;
  } else if (!ctx.tabstopPlaced && text === '' && childrenHtml === '' && node.children.length === 0) {
    inner = '$0';
    ctx.tabstopPlaced = true;
  }
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

function expand(abbr, jsx) {
  if (typeof abbr !== 'string' || abbr === '') return null;
  if (/^[A-Za-z][\w\-$]*$/.test(abbr)) return null; // pure text / lone tag
  let roots;
  try {
    roots = new Parser(abbr).parse();
  } catch {
    return null;
  }
  if (!roots.length) return null;
  const ctx = { tabstopPlaced: false };
  let out = roots.map((r) => renderNode(r, 1, jsx, ctx)).join('');
  if (!ctx.tabstopPlaced) out += '$0';
  return out;
}

/** Expand an Emmet abbreviation to an HTML snippet string (with one $0 tabstop), or null. */
export function expandEmmet(abbreviation) {
  return expand(abbreviation, false);
}

/** Expand an Emmet abbreviation to a JSX snippet string (className/htmlFor), or null. */
export function expandEmmetJsx(abbreviation) {
  return expand(abbreviation, true);
}

// Matches the trailing abbreviation on the current line, e.g. "ul>li.item$*3".
// Includes /, =, quotes for [attr="a b"] values.
const ABBR_RE = /([A-Za-z0-9.#>*+^()[\]{}@:$!\-_/"'=]+)$/;

/**
 * Wire a smart Tab keybinding onto a Monaco editor instance.
 * When the text before the cursor is a valid Emmet abbreviation (in an
 * HTML/JSX file), Tab expands it via the snippet controller; otherwise the
 * keypress is left alone so normal Tab behavior (indent, accept suggestion)
 * is preserved. Tab is skipped when a suggestion widget is open or when
 * there is a non-collapsed selection.
 */
export function registerEmmet(editor, monaco) {
  return editor.onKeyDown((e) => {
    if (e.code !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!editor.hasTextFocus()) return;

    // Let an open suggestion/completion widget keep Tab (accept suggestion).
    try {
      const suggest = editor.getContribution('editor.contrib.suggestController');
      if (suggest && suggest.model && suggest.model.state !== 0) return;
    } catch { /* contribution unavailable */ }

    const model = editor.getModel();
    if (!model) return;
    const selections = editor.getSelections();
    if (!selections || selections.length !== 1) return;
    const sel = selections[0];
    if (!sel.isEmpty()) return; // non-collapsed selection -> normal indent

    const lang = model.getLanguageId();
    const expand = (lang === 'javascriptreact' || lang === 'typescriptreact')
      ? expandEmmetJsx
      : (lang === 'html' ? expandEmmet : null);
    if (!expand) return;

    const pos = sel.getPosition();
    const before = model.getLineContent(pos.lineNumber).slice(0, pos.column - 1);
    const m = ABBR_RE.exec(before);
    if (!m) return;
    let expansion = null;
    try { expansion = expand(m[1]); } catch { expansion = null; }
    if (!expansion) return; // not a valid abbreviation -> let Tab pass through

    e.preventDefault();
    e.stopPropagation();

    const range = new monaco.Range(pos.lineNumber, pos.column - m[1].length, pos.lineNumber, pos.column);
    editor.setSelections([new monaco.Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)]);

    let ctrl = null;
    try { ctrl = editor.getContribution('snippetController2'); } catch { /* ignore */ }
    if (ctrl && typeof ctrl.insert === 'function') {
      ctrl.insert(expansion);
    } else {
      const plain = expansion.replace(/\$\d+|\$\{\d+:[^}]*\}/g, '');
      editor.executeEdits('emmet', [{ range, text: plain }]);
    }
  });
}
