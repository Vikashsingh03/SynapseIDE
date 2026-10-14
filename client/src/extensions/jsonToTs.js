/**
 * JSON → TypeScript interface generator (pure, React-free).
 *
 * generateTypes(jsonValue, rootName) → TypeScript source string.
 * Nested objects become separate interfaces named Parent + PascalCase(key);
 * name collisions across branches get numeric suffixes (User, User2).
 * Arrays take the item type from the FIRST element; empty arrays → unknown[].
 * Primitives map naturally; null → unknown.
 */

function pascalCase(raw) {
  const parts = String(raw ?? '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!parts.length) return '';
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function sanitizeTypeName(raw, fallback) {
  let name = pascalCase(raw);
  if (!name) name = fallback || 'Type';
  if (/^[0-9]/.test(name)) name = 'Type' + name;
  return name;
}

function primitiveType(v) {
  if (v === null || v === undefined) return 'unknown';
  const t = typeof v;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'unknown';
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * @param {*} jsonValue parsed JSON value
 * @param {string} rootName desired root interface/type name (already sanitized)
 * @returns {string} TypeScript declarations
 */
export function generateTypes(jsonValue, rootName) {
  const root = sanitizeTypeName(rootName, 'Root');
  const decls = []; // { name, text }
  const taken = new Set();

  function uniqueName(base) {
    let name = base;
    let n = 2;
    while (taken.has(name)) {
      name = base + n;
      n += 1;
    }
    taken.add(name);
    return name;
  }

  // Returns the TS type for a value; registers interfaces as a side effect.
  function typeOf(value, suggestedName) {
    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';
      const itemName = suggestedName + 'Item';
      const itemType = typeOf(value[0], itemName);
      return itemType + '[]';
    }
    if (isPlainObject(value)) {
      return declareInterface(value, suggestedName);
    }
    return primitiveType(value);
  }

  function declareInterface(obj, suggestedName) {
    const name = uniqueName(sanitizeTypeName(suggestedName, 'Type'));
    const lines = Object.entries(obj).map(([key, val]) => {
      const fieldType = typeOf(val, name + pascalCase(key));
      return `  ${JSON.stringify(key)}: ${fieldType};`;
    });
    decls.push({ name, text: `export interface ${name} {\n${lines.join('\n')}\n}` });
    return name;
  }

  let rootDecl = '';
  if (Array.isArray(jsonValue)) {
    if (jsonValue.length > 0 && isPlainObject(jsonValue[0])) {
      const itemType = typeOf(jsonValue[0], root + 'Item');
      rootDecl = `export type ${root} = ${itemType}[];`;
    } else {
      const itemType = jsonValue.length > 0 ? primitiveType(jsonValue[0]) : 'unknown';
      rootDecl = `export type ${root} = ${itemType}[];`;
    }
  } else if (isPlainObject(jsonValue)) {
    declareInterface(jsonValue, root);
  } else {
    rootDecl = `export type ${root} = ${primitiveType(jsonValue)};`;
  }

  const parts = decls.map((d) => d.text);
  if (rootDecl) parts.push(rootDecl);
  return parts.join('\n\n') + '\n';
}
