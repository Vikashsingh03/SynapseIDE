












const REQUEST_LINE_RE =
  /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)\s*$/i;
const HEADER_LINE_RE = /^([A-Za-z0-9!#$%&'*+\-.^_`|~]+)\s*:\s*(.*)$/;
const VAR_RE = /\{\{([A-Za-z0-9_.@-]+)\}\}/g;

export function substituteVars(text, vars = {}) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(VAR_RE, (m, key) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, key)) {
      const v = vars[key];
      return v === undefined || v === null ? m : String(v);
    }
    return m; 
  });
}

function isComment(line) {
  const t = line.trimStart();
  return t.startsWith('#') || t.startsWith('//');
}

export function parseHttpFile(text, vars = {}) {
  const requests = [];
  const lines = String(text || '').split(/\r?\n/);

  let cur = null; 
  let state = 'idle'; 

  const startRequest = (name) => {
    cur = {
      name: name || undefined,
      method: 'GET',
      url: '',
      headers: [],
      bodyLines: [],
    };
    state = 'request'; 
  };

  const push = () => {
    if (cur && cur.url) {
      const body = cur.bodyLines.join('\n');
      const headers = {};
      for (const [k, v] of cur.headers) headers[k] = substituteVars(v, vars);
      requests.push({
        name: cur.name ? substituteVars(cur.name, vars) : undefined,
        method: cur.method,
        url: substituteVars(cur.url, vars),
        headers,
        body: substituteVars(body, vars),
      });
    }
    cur = null;
    state = 'idle';
  };

  const parseRequestLine = (trimmed) => {
    const m = trimmed.match(REQUEST_LINE_RE);
    if (m) {
      cur.method = m[1].toUpperCase();
      cur.url = m[2];
      state = 'headers';
      return true;
    }
    if (trimmed) {
      
      cur.url = trimmed;
      state = 'headers';
      return true;
    }
    return false;
  };

  for (const raw of lines) {
    const trimmed = raw.trim();

    
    if (trimmed.startsWith('###')) {
      push();
      startRequest(trimmed.slice(3).trim());
      continue;
    }

    if (state === 'idle') {
      
      if (!trimmed || isComment(raw)) continue;
      startRequest(undefined);
      parseRequestLine(trimmed);
      continue;
    }

    if (state === 'request') {
      
      if (!trimmed || isComment(raw)) continue;
      parseRequestLine(trimmed);
      continue;
    }

    if (state === 'headers') {
      if (!trimmed) {
        state = 'body';
        continue;
      }
      if (isComment(raw)) continue;
      const hm = raw.match(HEADER_LINE_RE);
      if (hm) {
        cur.headers.push([hm[1], hm[2]]);
        continue;
      }
      
      state = 'body';
      cur.bodyLines.push(raw);
      continue;
    }

    
    cur.bodyLines.push(raw);
  }

  push();
  
  for (const r of requests) r.body = r.body.replace(/\s+$/, '');
  return requests;
}
