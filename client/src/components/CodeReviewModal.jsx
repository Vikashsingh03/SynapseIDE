import { useEffect, useState } from 'react';
import { useFiles } from '../contexts/FileContext';
import { chatWithNeura } from '../services/aiService';
import { getLanguageByExtension } from '../utils/languageMap';
import { getThemeClasses } from '../utils/theme';
import {
  X,
  ScanSearch,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Lightbulb,
  FileWarning,
} from 'lucide-react';

const SEVERITY_META = {
  CRITICAL: {
    label: 'Critical',
    badge: 'bg-(--red)/10 text-(--red) border-(--red)/30',
    Icon: AlertOctagon,
  },
  WARNING: {
    label: 'Warning',
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    Icon: AlertTriangle,
  },
  SUGGESTION: {
    label: 'Suggestion',
    badge: 'bg-(--blue)/10 text-(--blue) border-(--blue)/30',
    Icon: Lightbulb,
  },
};

/**
 * Parses Neura's structured review output.
 * Expected format per finding:
 *   [SEVERITY] Short title
 *   1-3 lines of explanation + fix
 * Or a single: [CLEAN] ...
 */
function parseReview(text) {
  const findings = [];
  let current = null;
  let clean = false;
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (/^\[CLEAN\]/i.test(line)) {
      clean = true;
      continue;
    }
    const m = line.match(/^\[(CRITICAL|WARNING|SUGGESTION)\]\s*(.*)$/i);
    if (m) {
      if (current) findings.push(current);
      current = {
        severity: m[1].toUpperCase(),
        title: m[2].trim() || 'Issue found',
        body: '',
      };
    } else if (current && line && !line.startsWith('```')) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) findings.push(current);
  return { clean: clean && findings.length === 0, findings };
}

export default function CodeReviewModal({ open, onClose, theme = 'dark' }) {
  const { activeFile } = useFiles();
  const t = getThemeClasses(theme);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [findings, setFindings] = useState([]);
  const [isClean, setIsClean] = useState(false);
  const [error, setError] = useState('');
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const run = async () => {
      const code = activeFile?.content || '';
      if (!code.trim()) {
        setStatus('error');
        setError('Open a file with some code first, then run the review.');
        return;
      }
      setStatus('loading');
      setError('');
      setFindings([]);
      setIsClean(false);

      const lang = getLanguageByExtension(activeFile?.name || '');
      const prompt = [
        'You are a senior code reviewer. Review the following ' + lang.name + ' code and list every issue you find.',
        '',
        'File: ' + (activeFile?.name || 'untitled'),
        '```',
        code,
        '```',
        '',
        'RULES:',
        '- For each issue output EXACTLY one line: [SEVERITY] Short title',
        '  where SEVERITY is one of CRITICAL, WARNING, SUGGESTION',
        '- Then write 1-3 lines explaining the issue and how to fix it.',
        '- Order findings: CRITICAL first, then WARNING, then SUGGESTION.',
        '- If the code is clean, output exactly: [CLEAN] No issues found',
        '- No intro or outro text, only the findings.',
      ].join('\n');

      try {
        const res = await chatWithNeura({
          message: prompt,
          context: { fileName: activeFile?.name, language: lang.name },
        });
        if (cancelled) return;
        const text = res?.assistantMessage?.content || res?.reply || '';
        const parsed = parseReview(text);
        if (parsed.clean) {
          setIsClean(true);
        } else if (parsed.findings.length) {
          setFindings(parsed.findings);
        } else {
          setFindings([{ severity: 'SUGGESTION', title: 'Review notes', body: text }]);
        }
        setStatus('done');
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Code review failed. Please try again.');
          setStatus('error');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId]);

  if (!open) return null;

  const counts = findings.reduce(
    (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }),
    {}
  );

  const badgeFor = (sev) => {
    const meta = SEVERITY_META[sev] || SEVERITY_META.SUGGESTION;
    return meta.badge;
  };

  return (
    <div className={t.modalOverlay} onClick={onClose}>
      <div
        className={`${t.modalCard} w-[min(720px,94vw)] max-h-[84vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border} shrink-0`}>
          <span className="flex items-center justify-center w-9 h-9 rounded-md border bg-(--blue)/10 border-(--blue)/30">
            <ScanSearch size={17} className="text-(--blue)" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-extrabold ${t.textPrimary}`}>Neura Code Review</h2>
            <p className={`text-xs ${t.textMuted} truncate font-mono`}>{activeFile?.name || 'untitled'}</p>
          </div>
          {status === 'done' && !isClean && (
            <div className="flex items-center gap-1.5">
              {Object.entries(SEVERITY_META).map(([sev, meta]) =>
                counts[sev] ? (
                  <span
                    key={sev}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeFor(sev)}`}
                  >
                    {counts[sev]} {meta.label}
                  </span>
                ) : null
              )}
            </div>
          )}
          <button onClick={onClose} className={t.iconBtn} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12 animate-fade-in">
              <Loader2 size={28} className="animate-spin text-(--blue)" />
              <p className={`text-sm font-mono ${t.textMuted}`}>
                Neura is reviewing <span className="font-bold">{activeFile?.name}</span>…
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-10 animate-fade-in">
              <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
                <FileWarning size={18} className="text-amber-500" />
              </span>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm`}>{error}</p>
              <button onClick={() => setRunId((id) => id + 1)} className={t.btnSecondary}>
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          )}

          {status === 'done' && isClean && (
            <div className="flex flex-col items-center gap-3 py-10 animate-fade-in">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className={`text-base font-extrabold ${t.textPrimary}`}>Clean code</p>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm font-mono`}>
                Neura found no critical issues, warnings or suggestions in this file.
              </p>
            </div>
          )}

          {status === 'done' && !isClean && (
            <div className="space-y-3 animate-fade-in">
              {findings.map((f, i) => {
                const meta = SEVERITY_META[f.severity] || SEVERITY_META.SUGGESTION;
                const Icon = meta.Icon;
                return (
                  <div
                    key={i}
                    className="rounded-lg border p-4 bg-(--paper) border-(--line)"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeFor(f.severity)}`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      <p className={`text-sm font-bold ${t.textPrimary}`}>{f.title}</p>
                    </div>
                    {f.body && (
                      <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${t.textMuted} pl-1`}>
                        {f.body}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-t ${t.border} shrink-0`}>
          <p className={`text-[11px] ${t.textMuted}`}>Powered by Neura AI · Always double-check critical findings</p>
          <button
            onClick={() => setRunId((id) => id + 1)}
            disabled={status === 'loading'}
            className={`${t.btnSecondary} disabled:opacity-50`}
          >
            <RotateCcw size={14} /> Review again
          </button>
        </div>
      </div>
    </div>
  );
}
