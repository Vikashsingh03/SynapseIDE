// deployConfigs.js — project detection + deployment config generators.
// Pure functions, zero imports. Used by DeployPanel.jsx.

export const PROJECT_TYPES = ['react-vite', 'node', 'python', 'static', 'unknown'];

export const TYPE_LABELS = {
  'react-vite': 'React + Vite',
  node: 'Node.js backend',
  python: 'Python',
  static: 'Static site',
  unknown: 'Unknown',
};

export const DEFAULT_PORTS = {
  'react-vite': 5173,
  node: 5000,
  python: 8000,
  static: 80,
  unknown: 3000,
};

/**
 * Detect the project type from the file list.
 * files = [{ name, type, parentId?, content? }]
 * Returns { type, name, port, entry, evidence: [strings] }.
 * - entry: suggested server entry file (null when not applicable)
 */
export function detectProject(files = []) {
  const list = (files || []).filter((f) => f && f.type === 'file');
  const root = list.filter((f) => f.parentId == null);
  const byName = (n) => list.find((f) => f.name === n);
  const rootHas = (n) => root.some((f) => f.name === n);

  const evidence = [];
  let type = 'unknown';
  let name = 'my-app';
  let port = null;
  let entry = null;

  const pkgFile = byName('package.json');
  let pkg = null;
  if (pkgFile && typeof pkgFile.content === 'string' && pkgFile.content.trim()) {
    try {
      pkg = JSON.parse(pkgFile.content);
      evidence.push(`package.json found${pkg.name ? ` (name: ${pkg.name})` : ''}`);
    } catch {
      evidence.push('package.json found (could not parse — treated as absent)');
    }
  }

  if (pkg) {
    if (typeof pkg.name === 'string' && pkg.name.trim()) name = pkg.name.trim();
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    const scripts = pkg.scripts || {};
    const scriptText = Object.values(scripts)
      .filter((s) => typeof s === 'string')
      .join(' ');
    // Port from scripts (PORT=8080, --port 8080) or a top-level port field
    const portMatch = scriptText.match(/(?:\bPORT\s*=\s*|--port[=\s]+)(\d{3,5})/i);
    if (portMatch) port = parseInt(portMatch[1], 10);
    if (!port && Number.isInteger(pkg.port)) port = pkg.port;

    if (deps.react) {
      evidence.push('react dependency detected');
      if (deps.vite || /vite/i.test(scriptText)) {
        evidence.push('vite detected in dependencies/scripts');
        type = 'react-vite';
      } else {
        type = 'node';
      }
    } else if (deps.express || scripts.start || pkg.main) {
      if (deps.express) evidence.push('express dependency detected');
      if (scripts.start) evidence.push(`start script: ${scripts.start}`);
      if (pkg.main) evidence.push(`main field: ${pkg.main}`);
      type = 'node';
    } else if (rootHas('index.html')) {
      // package.json exists but no framework signals — treat as a static page
      evidence.push('index.html at root (no framework detected)');
      type = 'static';
    }
  }

  // Root server-file fallback when package.json gave no signal
  if (type === 'unknown' && !pkg) {
    const serverFile = ['server.js', 'index.js', 'app.js'].find(rootHas);
    if (serverFile) {
      evidence.push(`root ${serverFile} detected`);
      type = 'node';
    }
  }

  if (type === 'unknown' && !pkg) {
    if (rootHas('index.html')) {
      evidence.push('index.html at root, no package.json');
      type = 'static';
    } else if (rootHas('requirements.txt') || rootHas('app.py')) {
      evidence.push(rootHas('requirements.txt') ? 'requirements.txt detected' : 'app.py detected');
      type = 'python';
    }
  }

  if (!evidence.length) evidence.push('no recognizable project files found');

  if (!port) port = DEFAULT_PORTS[type] ?? 3000;
  if (type === 'node') entry = 'index.js';
  if (type === 'python') entry = 'app.py';

  return { type, name, port, entry, evidence };
}

/** vercel.json generator. entry is the serverless function entry (node/python). */
export function vercelJson(type, entry = 'index.js') {
  const e = entry || 'index.js';
  const cfg =
    type === 'react-vite' || type === 'static'
      ? {
          $schema: 'https://openapi.vercel.sh/vercel.json',
          rewrites: [{ source: '/(.*)', destination: '/index.html' }],
        }
      : {
          $schema: 'https://openapi.vercel.sh/vercel.json',
          version: 2,
          builds: [{ src: e, use: type === 'python' ? '@vercel/python' : '@vercel/node' }],
          routes: [{ src: '/(.*)', dest: e }],
        };
  return JSON.stringify(cfg, null, 2) + '\n';
}

/** render.yaml (Render Blueprint) generator. */
export function renderYaml(name, type, entry = 'index.js') {
  const e = entry || 'index.js';
  const safe =
    String(name || 'my-app')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-app';

  if (type === 'react-vite') {
    return [
      'services:',
      '  - type: web',
      `    name: ${safe}`,
      '    runtime: static',
      '    plan: free',
      '    buildCommand: npm install && npm run build',
      '    staticPublishPath: ./dist',
      '',
    ].join('\n');
  }
  if (type === 'static') {
    return [
      'services:',
      '  - type: web',
      `    name: ${safe}`,
      '    runtime: static',
      '    plan: free',
      '    staticPublishPath: ./',
      '',
    ].join('\n');
  }
  if (type === 'python') {
    return [
      'services:',
      '  - type: web',
      `    name: ${safe}`,
      '    runtime: python',
      '    plan: free',
      '    buildCommand: pip install -r requirements.txt',
      `    startCommand: python ${e}`,
      '    envVars:',
      '      - key: PORT',
      '        value: 10000',
      '',
    ].join('\n');
  }
  // node + unknown (best guess: node)
  return [
    'services:',
    '  - type: web',
    `    name: ${safe}`,
    '    runtime: node',
    '    plan: free',
    '    buildCommand: npm install',
    `    startCommand: node ${e}`,
    '    envVars:',
    '      - key: PORT',
    '        value: 10000',
    '',
  ].join('\n');
}

/** netlify.toml generator. */
export function netlifyToml(type) {
  if (type === 'react-vite') {
    return [
      '# Netlify — React + Vite SPA',
      '[build]',
      '  command = "npm run build"',
      '  publish = "dist"',
      '',
      '[[redirects]]',
      '  from = "/*"',
      '  to = "/index.html"',
      '  status = 200',
      '',
    ].join('\n');
  }
  if (type === 'static') {
    return [
      '# Netlify — static site',
      '[build]',
      '  publish = "."',
      '',
      '[[redirects]]',
      '  from = "/*"',
      '  to = "/index.html"',
      '  status = 200',
      '',
    ].join('\n');
  }
  return [
    '# Netlify — backend note',
    '# For Node/Python APIs prefer Render; Netlify suits the frontend.',
    '# Keep this file if you also deploy a static frontend.',
    '[build]',
    '  command = "npm run build"',
    '  publish = "dist"',
    '',
    '[[redirects]]',
    '  from = "/*"',
    '  to = "/index.html"',
    '  status = 200',
    '',
  ].join('\n');
}

/** Dockerfile generator. opts = { port, entry } */
export function dockerfile(type, opts = {}) {
  const p = opts.port || DEFAULT_PORTS[type] || 3000;
  const e = opts.entry || 'index.js';

  if (type === 'react-vite') {
    return [
      '# ---- build stage ----',
      'FROM node:22-alpine AS build',
      'WORKDIR /app',
      'COPY package*.json ./',
      '# Uses npm ci when a lockfile exists, plain install otherwise',
      'RUN npm ci || npm install',
      'COPY . .',
      'RUN npm run build',
      '',
      '# ---- serve stage ----',
      'FROM nginx:alpine',
      'COPY --from=build /app/dist /usr/share/nginx/html',
      'EXPOSE 80',
      'CMD ["nginx", "-g", "daemon off;"]',
      '',
    ].join('\n');
  }
  if (type === 'python') {
    return [
      'FROM python:3.12-slim',
      'WORKDIR /app',
      'COPY requirements.txt ./',
      'RUN pip install --no-cache-dir -r requirements.txt',
      'COPY . .',
      `EXPOSE ${p}`,
      `CMD ["python", "${e}"]`,
      '',
    ].join('\n');
  }
  if (type === 'static') {
    return [
      'FROM nginx:alpine',
      'COPY . /usr/share/nginx/html',
      'EXPOSE 80',
      'CMD ["nginx", "-g", "daemon off;"]',
      '',
    ].join('\n');
  }
  // node + unknown (best guess: node)
  const guess = type === 'unknown' ? '# Project type not detected — assuming Node; adjust CMD as needed\n' : '';
  return [
    `${guess}FROM node:22-alpine`,
    'WORKDIR /app',
    'COPY package*.json ./',
    '# Uses npm ci when a lockfile exists, plain install otherwise',
    'RUN npm ci --omit=dev || npm install --omit=dev',
    'COPY . .',
    `EXPOSE ${p}`,
    `CMD ["node", "${e}"]`,
    '',
  ].join('\n');
}

/** .dockerignore generator. */
export function dockerignore() {
  return ['node_modules', '.git', 'dist', '.env', '*.log', 'coverage', ''].join('\n');
}
