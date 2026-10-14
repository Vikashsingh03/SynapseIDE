import { useState, useEffect, useMemo } from 'react';
import { useFiles } from '../contexts/FileContext';
import {
  detectProject,
  TYPE_LABELS,
  vercelJson,
  renderYaml,
  netlifyToml,
  dockerfile,
  dockerignore,
} from '../utils/deployConfigs';
import {
  Rocket,
  FilePlus2,
  ExternalLink,
  X,
  Container,
  Check,
} from 'lucide-react';

const PROVIDERS = [
  { label: 'Open Vercel', href: 'https://vercel.com/new' },
  { label: 'Open Netlify', href: 'https://app.netlify.com/start' },
  { label: 'Open Render', href: 'https://dashboard.render.com' },
];

/* ------------------------------------------------------------------ */
/* Deploy panel (default export — rendered by DeployHost)              */
/* ------------------------------------------------------------------ */

export default function DeployPanel({ onClose }) {
  const { files, createFile, updateContent } = useFiles();
  const [detected, setDetected] = useState(null);
  const [name, setName] = useState('my-app');
  const [port, setPort] = useState(5000);
  const [entry, setEntry] = useState('index.js');
  const [created, setCreated] = useState({});

  useEffect(() => {
    const d = detectProject(files);
    setDetected(d);
    setName(d.name);
    setPort(d.port);
    if (d.entry) setEntry(d.entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configs = useMemo(() => {
    if (!detected) return [];
    const type = detected.type;
    const effEntry = entry || 'index.js';
    return [
      {
        fname: 'vercel.json',
        platform: 'Vercel',
        content: vercelJson(type, effEntry),
      },
      {
        fname: 'render.yaml',
        platform: 'Render',
        content: renderYaml(name, type, effEntry),
      },
      {
        fname: 'netlify.toml',
        platform: 'Netlify',
        content: netlifyToml(type),
      },
      {
        fname: 'Dockerfile',
        platform: 'Docker — any host',
        content: dockerfile(type, { port, entry: effEntry }),
      },
      {
        fname: '.dockerignore',
        platform: 'Docker — build context',
        content: dockerignore(),
      },
    ];
  }, [detected, name, port, entry]);

  const rootFileExists = (fname) =>
    files.some((f) => f.type === 'file' && f.parentId == null && f.name === fname);

  const handleCreate = (fname, content) => {
    if (created[fname] || rootFileExists(fname)) return;
    // createFile(name, parentId) returns the new file's id; parentId null = project root
    const id = createFile(fname, null);
    updateContent(id, content);
    setCreated((c) => ({ ...c, [fname]: true }));
  };

  const showEntry = detected && (detected.type === 'node' || detected.type === 'python');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
          <Rocket size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink)">Deploy</h2>
          <p className="text-[11px] text-(--muted)">Ship your project to the cloud</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close deploy panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {/* Detection */}
        {detected && (
          <div className="rounded-xl border border-(--line) bg-(--paper) p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-(--muted)">
                Detected
              </span>
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
                {TYPE_LABELS[detected.type] || detected.type}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {detected.evidence.map((e, i) => (
                <li key={i} className="text-[11px] font-mono text-(--muted)">
                  <span className="text-(--acid) mr-1.5">›</span>
                  {e}
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--muted)">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full text-xs bg-(--ink)/5 border border-(--line) rounded-lg px-2.5 py-1.5 text-(--ink) outline-none focus:border-(--blue)/60"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--muted)">
                  Port
                </span>
                <input
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value, 10) || 0)}
                  type="number"
                  className="mt-1 w-full text-xs bg-(--ink)/5 border border-(--line) rounded-lg px-2.5 py-1.5 text-(--ink) outline-none focus:border-(--blue)/60"
                />
              </label>
              {showEntry && (
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-(--muted)">
                    Entry
                  </span>
                  <input
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    className="mt-1 w-full text-xs font-mono bg-(--ink)/5 border border-(--line) rounded-lg px-2.5 py-1.5 text-(--ink) outline-none focus:border-(--blue)/60"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Config cards */}
        {configs.map((c) => {
          const exists = rootFileExists(c.fname);
          const done = created[c.fname];
          return (
            <div key={c.fname} className="rounded-xl border border-(--line) bg-(--paper) p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-(--ink) truncate">
                  {c.fname}
                </span>
                <span className="text-[10px] text-(--muted) truncate">{c.platform}</span>
                <div className="flex-1" />
                {done || exists ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                      done
                        ? 'bg-(--acid)/10 border-(--acid)/30 text-(--acid)'
                        : 'bg-(--ink)/5 border-(--line) text-(--muted)'
                    }`}
                  >
                    {done && <Check size={12} />}
                    {done ? 'Created ✓' : 'Already exists'}
                  </span>
                ) : (
                  <button
                    onClick={() => handleCreate(c.fname, c.content)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/30 text-(--blue) hover:bg-(--blue)/20 transition-colors cursor-pointer"
                  >
                    <FilePlus2 size={12} />
                    Create in project
                  </button>
                )}
              </div>
              <pre className="mt-2.5 max-h-44 overflow-auto custom-scrollbar text-[11px] font-mono leading-relaxed bg-black/30 border border-(--line) rounded-lg p-3 text-(--ink)/85 whitespace-pre">
                {c.content}
              </pre>
            </div>
          );
        })}

        {/* Provider links */}
        <div className="rounded-xl border border-(--line) bg-(--paper) p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-(--muted) mb-2.5">
            Launch a provider
          </p>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-(--ink)/5 border border-(--line) text-(--ink) hover:border-(--blue)/50 hover:text-(--blue) transition-colors"
              >
                <ExternalLink size={12} />
                {p.label}
              </a>
            ))}
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-(--muted) leading-relaxed">
            <Container size={13} className="shrink-0 mt-0.5" />
            Running Docker locally? Generate the Dockerfile above, then open the
            Docker panel to manage containers.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-(--line) shrink-0">
        <p className="text-[11px] text-(--muted) leading-relaxed">
          Synapse generates the config + steps. The deploy itself runs on the
          provider with your account — no tokens or passwords are asked here.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Host — mounts once per app shell; listens for window events          */
/* ------------------------------------------------------------------ */

export function DeployHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const doOpen = () => setOpen(true);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('synapse:open-deploy', doOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('synapse:open-deploy', doOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-[560px] max-w-[94vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <DeployPanel onClose={() => setOpen(false)} />
    </div>
  );
}
