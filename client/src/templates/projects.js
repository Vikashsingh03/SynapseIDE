





export const PROJECT_TEMPLATES = [
  {
    id: 'react-vite',
    name: 'React App (Vite)',
    tagline: 'React 19 + Vite with a clean starter page',
    icon: 'Atom',
    accent: '#61DAFB',
    rootName: 'my-react-app',
    mainFile: 'src/App.jsx',
    files: [
      {
        path: 'package.json',
        content: `{
  "name": "my-react-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.0"
  }
}
`,
      },
      {
        path: 'vite.config.js',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});
`,
      },
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React + Vite</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      },
      {
        path: 'src/main.jsx',
        content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
      },
      {
        path: 'src/App.jsx',
        content: `import { useState } from 'react';
import './App.css';

const FEATURES = [
  { title: 'Vite', text: 'Lightning-fast dev server with instant hot reload.' },
  { title: 'React 19', text: 'Components, hooks and the latest React features.' },
  { title: 'Starter', text: 'A tidy base to grow your own app from.' },
];

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <section className="hero">
        <h1>
          React <span>+</span> Vite
        </h1>
        <p className="subtitle">
          Edit <code>src/App.jsx</code> and save — the page updates instantly.
        </p>
        <button className="counter" onClick={() => setCount((c) => c + 1)}>
          Count is {count}
        </button>
      </section>
      <section className="cards">
        {FEATURES.map((f) => (
          <article className="card" key={f.title}>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
`,
      },
      {
        path: 'src/index.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #0f1115;
  color: #e8eaf0;
  min-height: 100vh;
}

code {
  font-family: 'Cascadia Code', Consolas, monospace;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.9em;
}
`,
      },
      {
        path: 'src/App.css',
        content: `.app {
  max-width: 880px;
  margin: 0 auto;
  padding: 64px 24px;
}

.hero {
  text-align: center;
  padding: 48px 0;
}

.hero h1 {
  font-size: 3rem;
  letter-spacing: -0.02em;
}

.hero h1 span {
  color: #61dafb;
}

.subtitle {
  margin-top: 12px;
  color: #9aa1b2;
  font-size: 1.05rem;
}

.counter {
  margin-top: 28px;
  padding: 12px 28px;
  font-size: 1rem;
  font-weight: 600;
  color: #0f1115;
  background: #61dafb;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.counter:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(97, 218, 251, 0.35);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 32px;
}

.card {
  background: #171a21;
  border: 1px solid #262b36;
  border-radius: 14px;
  padding: 24px;
}

.card h2 {
  font-size: 1.1rem;
  margin-bottom: 8px;
  color: #61dafb;
}

.card p {
  color: #9aa1b2;
  line-height: 1.55;
  font-size: 0.95rem;
}
`,
      },
      {
        path: 'README.md',
        content: `# React + Vite

A minimal React 19 app powered by Vite.

## Run it

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open the URL Vite prints (usually http://localhost:5173).

## Build

\`\`\`bash
npm run build   # production bundle in dist/
npm run preview # serve the production bundle locally
\`\`\`

Edit \`src/App.jsx\` to make it yours.
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
.DS_Store
`,
      },
    ],
  },
  {
    id: 'react-tailwind',
    name: 'React + Tailwind',
    tagline: 'React 19 with Tailwind CSS utility styling',
    icon: 'Palette',
    accent: '#38BDF8',
    rootName: 'my-tailwind-app',
    mainFile: 'src/App.jsx',
    files: [
      {
        path: 'package.json',
        content: `{
  "name": "my-tailwind-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "vite": "^6.0.0"
  }
}
`,
      },
      {
        path: 'vite.config.js',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
`,
      },
      {
        path: 'tailwind.config.js',
        content: `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
      },
      {
        path: 'postcss.config.js',
        content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
      },
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React + Tailwind</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      },
      {
        path: 'src/main.jsx',
        content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
      },
      {
        path: 'src/App.jsx',
        content: `import { useState } from 'react';

const CARDS = [
  { title: 'Utility-first', text: 'Style with classes like p-6 and text-xl.' },
  { title: 'Responsive', text: 'md: and lg: prefixes adapt to any screen.' },
  { title: 'Fast', text: 'Unused styles are purged in production builds.' },
];

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">
          React <span className="text-sky-400">+</span> Tailwind
        </h1>
        <p className="mt-4 text-slate-400">
          Edit <code className="rounded bg-slate-800 px-2 py-0.5">src/App.jsx</code> and
          save — hot reload handles the rest.
        </p>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="mt-8 rounded-xl bg-sky-500 px-7 py-3 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-sky-400"
        >
          Count is {count}
        </button>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {CARDS.map((c) => (
            <article key={c.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left">
              <h2 className="font-semibold text-sky-400">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.text}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default App;
`,
      },
      {
        path: 'src/index.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
`,
      },
      {
        path: 'README.md',
        content: `# React + Tailwind CSS

React 19 + Vite + Tailwind CSS, ready to style.

## Run it

\`\`\`bash
npm install
npm run dev
\`\`\`

## How it works

- \`tailwind.config.js\` tells Tailwind where your classes live (\`index.html\` + \`src/\`).
- \`src/index.css\` injects Tailwind's base/components/utilities layers.
- Style components with utility classes in \`src/App.jsx\`.
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
.DS_Store
`,
      },
    ],
  },
  {
    id: 'html-starter',
    name: 'HTML/CSS/JS Website',
    tagline: 'A polished single-page site, zero build step',
    icon: 'Globe',
    accent: '#F97316',
    rootName: 'my-website',
    mainFile: 'index.html',
    files: [
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Website</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header class="site-header">
      <span class="logo">My Website</span>
      <nav>
        <a href="#features">Features</a>
        <a href="#contact" class="btn">Contact</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <h1>Build something great.</h1>
        <p>A clean starter page with HTML, CSS and vanilla JavaScript.</p>
        <button id="cta" class="btn btn-primary">Click me</button>
        <p id="message" class="message" hidden></p>
      </section>

      <section id="features" class="features">
        <article>
          <h2>No build tools</h2>
          <p>Just open index.html in a browser.</p>
        </article>
        <article>
          <h2>Responsive</h2>
          <p>Flexible layout that fits phones and desktops.</p>
        </article>
        <article>
          <h2>Easy to extend</h2>
          <p>Add pages, scripts and styles as you grow.</p>
        </article>
      </section>
    </main>

    <footer id="contact">
      <p>Made with HTML, CSS and JavaScript.</p>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'style.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #0d0f14;
  color: #e8eaf0;
  line-height: 1.6;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 32px;
  border-bottom: 1px solid #1e2230;
}

.logo {
  font-weight: 800;
  font-size: 1.2rem;
}

nav {
  display: flex;
  gap: 20px;
  align-items: center;
}

nav a {
  color: #9aa1b2;
  text-decoration: none;
  font-size: 0.95rem;
}

nav a:hover {
  color: #fff;
}

.btn {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 10px;
  border: 1px solid #2b3145;
  color: #e8eaf0;
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  font-size: 0.95rem;
}

.btn-primary {
  background: linear-gradient(135deg, #f97316, #ef4444);
  border: none;
  color: #fff;
  font-weight: 600;
}

.hero {
  text-align: center;
  padding: 110px 24px 80px;
}

.hero h1 {
  font-size: 3rem;
  letter-spacing: -0.02em;
  background: linear-gradient(120deg, #fff, #f97316);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero p {
  margin-top: 14px;
  color: #9aa1b2;
}

.hero .btn-primary {
  margin-top: 28px;
}

.message {
  margin-top: 18px;
  color: #4ade80;
  font-weight: 600;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}

.features article {
  background: #141722;
  border: 1px solid #1e2230;
  border-radius: 14px;
  padding: 26px;
}

.features h2 {
  font-size: 1.05rem;
  margin-bottom: 8px;
  color: #fb923c;
}

.features p {
  color: #9aa1b2;
  font-size: 0.95rem;
}

footer {
  text-align: center;
  padding: 32px;
  border-top: 1px solid #1e2230;
  color: #6b7280;
  font-size: 0.9rem;
}
`,
      },
      {
        path: 'script.js',
        content: `// Small interactions for the starter page.

const ctaButton = document.getElementById('cta');
const message = document.getElementById('message');

ctaButton.addEventListener('click', () => {
  message.hidden = false;
  message.textContent = 'Button clicked! Now make this page yours.';
});

// Smooth scroll for in-page links.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
`,
      },
      {
        path: 'README.md',
        content: `# My Website

A hand-built starter website — HTML, CSS and vanilla JavaScript.

## View it

Open \`index.html\` in your browser. No build step, no dependencies.

- \`index.html\` — page structure
- \`style.css\` — all styling
- \`script.js\` — button interaction + smooth scrolling
`,
      },
    ],
  },
  {
    id: 'node-express',
    name: 'Node + Express API',
    tagline: 'REST API with routes, CORS and env config',
    icon: 'Server',
    accent: '#22C55E',
    rootName: 'my-api',
    mainFile: 'server.js',
    files: [
      {
        path: 'package.json',
        content: `{
  "name": "my-api",
  "version": "0.1.0",
  "description": "Express REST API starter",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.2"
  }
}
`,
      },
      {
        path: 'server.js',
        content: `import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/tasks', tasksRouter);

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log('API running on http://localhost:' + PORT);
});
`,
      },
      {
        path: 'routes/tasks.js',
        content: `import { Router } from 'express';

const router = Router();

// In-memory store (swap for a database later)
let tasks = [
  { id: 1, title: 'Learn Express', done: true },
  { id: 2, title: 'Build an API', done: false },
];
let nextId = 3;

// GET /api/tasks
router.get('/', (req, res) => {
  res.json(tasks);
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks  { "title": "..." }
router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const task = { id: nextId++, title: title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id  { "done": true }
router.patch('/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (typeof req.body.done === 'boolean') task.done = req.body.done;
  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    task.title = req.body.title.trim();
  }
  res.json(task);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Task not found' });
  const [removed] = tasks.splice(index, 1);
  res.json(removed);
});

export default router;
`,
      },
      {
        path: '.env.example',
        content: `# Copy to .env and adjust
PORT=3000
`,
      },
      {
        path: 'README.md',
        content: `# Express API

A tidy Express starter with a small in-memory tasks API.

## Run it

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## Try it

- \`GET  /api/health\` — health check
- \`GET  /api/tasks\` — list tasks
- \`POST /api/tasks\` — body: \`{ "title": "New task" }\`
- \`PATCH /api/tasks/:id\` — body: \`{ "done": true }\`
- \`DELETE /api/tasks/:id\` — remove a task

## Structure

- \`server.js\` — app setup, middleware, route mounting
- \`routes/tasks.js\` — tasks router (in-memory store for now)
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
.env
.DS_Store
`,
      },
    ],
  },
  {
    id: 'python-basic',
    name: 'Python Starter',
    tagline: 'Clean Python project with helpers and tests-ready layout',
    icon: 'FileCode',
    accent: '#FFD43B',
    rootName: 'my-python-app',
    mainFile: 'main.py',
    files: [
      {
        path: 'main.py',
        content: `"""Entry point for the project."""

import argparse
from utils.helpers import greet, word_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Python starter project")
    parser.add_argument(
        "--name",
        default="World",
        help="Name to greet (default: World)",
    )
    args = parser.parse_args()

    print(greet(args.name))
    print("Sample text has", word_count("Hello from the Python starter"), "words")


if __name__ == "__main__":
    main()
`,
      },
      {
        path: 'utils/helpers.py',
        content: `"""Small reusable helpers."""


def greet(name: str) -> str:
    """Return a friendly greeting for the given name."""
    clean = name.strip() or "World"
    return f"Hello, {clean}!"


def word_count(text: str) -> int:
    """Count words in a string, ignoring extra whitespace."""
    return len(text.split())


def to_slug(text: str) -> str:
    """Convert a title into a URL-friendly slug."""
    return "-".join(text.strip().lower().split())
`,
      },
      {
        path: 'utils/__init__.py',
        content: `"""Utility package."""
`,
      },
      {
        path: 'requirements.txt',
        content: `# Add project dependencies below, e.g.
# requests==2.32.3
`,
      },
      {
        path: 'README.md',
        content: `# Python Starter

A clean Python project layout with a helpers package.

## Run it

\`\`\`bash
python main.py
python main.py --name Vikash
\`\`\`

## Layout

- \`main.py\` — entry point (argument parsing + demo calls)
- \`utils/helpers.py\` — small reusable functions
- \`requirements.txt\` — third-party dependencies
`,
      },
    ],
  },
  {
    id: 'cpp-dsa',
    name: 'C++ DSA Practice',
    tagline: 'Fast-I/O boilerplate for problem solving',
    icon: 'Cpu',
    accent: '#60A5FA',
    rootName: 'dsa-practice',
    mainFile: 'main.cpp',
    files: [
      {
        path: 'main.cpp',
        content: `#include <bits/stdc++.h>
using namespace std;

// One problem per run — put your logic in solve().
void solve() {
    int n;
    if (!(cin >> n)) return;
    vector<long long> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];

    // Example: print the array in reverse.
    reverse(a.begin(), a.end());
    for (int i = 0; i < n; i++) {
        if (i) cout << ' ';
        cout << a[i];
    }
    cout << '\\n';
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t = 1;
    // Uncomment for multiple test cases:
    // cin >> t;
    while (t--) solve();
    return 0;
}
`,
      },
      {
        path: 'README.md',
        content: `# C++ DSA Practice

A minimal competitive-programming / DSA boilerplate.

## Pattern

- \`solve()\` holds one problem's logic — read input, print output.
- \`main()\` handles fast I/O and (optionally) multiple test cases.
- Keep one file per problem: copy \`main.cpp\` to \`two-sum.cpp\`, etc.

## Tips

- Use \`vector\`, \`map\`, \`set\`, \`priority_queue\` from the STL.
- Prefer \`long long\` for large numbers.
- Compile locally: \`g++ -std=c++17 -O2 main.cpp -o main\`
`,
      },
    ],
  },
  {
    id: 'react-native',
    name: 'React Native (Expo)',
    tagline: 'Mobile app starter — runs with Expo Go',
    icon: 'Smartphone',
    accent: '#A78BFA',
    rootName: 'my-expo-app',
    mainFile: 'App.js',
    files: [
      {
        path: 'package.json',
        content: `{
  "name": "my-expo-app",
  "version": "1.0.0",
  "main": "App.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2"
  },
  "private": true
}
`,
      },
      {
        path: 'App.js',
        content: `import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [taps, setTaps] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Expo App</Text>
      <Text style={styles.subtitle}>
        Edit App.js and save — Expo reloads instantly.
      </Text>
      <Pressable style={styles.button} onPress={() => setTaps((t) => t + 1)}>
        <Text style={styles.buttonText}>Tapped {taps} times</Text>
      </Pressable>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#9aa1b2',
    textAlign: 'center',
  },
  button: {
    marginTop: 28,
    backgroundColor: '#a78bfa',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: '#0f1115',
    fontWeight: '700',
    fontSize: 16,
  },
});
`,
      },
      {
        path: 'app.json',
        content: `{
  "expo": {
    "name": "my-expo-app",
    "slug": "my-expo-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0f1115"
      }
    },
    "web": {
      "bundler": "metro"
    }
  }
}
`,
      },
      {
        path: 'babel.config.js',
        content: `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
`,
      },
      {
        path: 'README.md',
        content: `# React Native (Expo)

A starter mobile app that runs with Expo tooling.

## Run it (on your own machine)

\`\`\`bash
npm install
npx expo start
\`\`\`

- Scan the QR code with the **Expo Go** app (Android/iOS) to run it on your phone.
- Press \`w\` to run in the browser, \`a\` for an Android emulator.

## Layout

- \`App.js\` — the root screen (edit and save to reload)
- \`app.json\` — Expo app configuration
- \`babel.config.js\` — Babel setup via babel-preset-expo
`,
      },
    ],
  },
];
