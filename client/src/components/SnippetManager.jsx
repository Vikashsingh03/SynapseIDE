import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Code2,
  Sparkles,
  ChevronRight,
  Save,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import {
  getSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
} from '../services/snippetService';

const LANGUAGES = ['all', 'python', 'cpp', 'java', 'javascript'];

const LANG_LABEL = {
  python: 'Python',
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript',
};

const LANG_COLOR = {
  python: 'text-[#4d7fff] border-[#4d7fff]/30 bg-[#4d7fff]/10',
  cpp: 'text-[#ff4d35] border-[#ff4d35]/30 bg-[#ff4d35]/10',
  java: 'text-[#ffd23f] border-[#ffd23f]/30 bg-[#ffd23f]/10',
  javascript: 'text-[#d9ff3f] border-[#d9ff3f]/30 bg-[#d9ff3f]/10',
};

function SnippetForm({ initial, onSave, onCancel, theme }) {
  const t = getThemeClasses(theme);
  const [form, setForm] = useState({
    name: initial?.name || '',
    prefix: initial?.prefix || '',
    language: initial?.language || 'python',
    category: initial?.category || 'custom',
    description: initial?.description || '',
    code: initial?.code || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name.trim() || !form.prefix.trim() || !form.code.trim()) {
      setError('Name, prefix and code are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = `w-full px-3 py-2 rounded-lg border ${t.border} bg-(--panel) ${t.textPrimary} text-[13px] font-mono outline-none focus:border-(--blue) transition-colors`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Name (e.g. Binary search)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Prefix (e.g. binsearch)"
          value={form.prefix}
          onChange={(e) => setForm({ ...form, prefix: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select
          className={inputCls}
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
        >
          {Object.entries(LANG_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          className={inputCls}
          placeholder="Category (e.g. algorithms)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
      </div>
      <input
        className={inputCls}
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <textarea
        className={`${inputCls} min-h-[160px] resize-y leading-relaxed`}
        placeholder={'Code… use ${1:placeholder} for tab stops, $0 for final cursor'}
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value })}
        spellCheck={false}
      />
      <p className={`font-mono text-[11px] ${t.textMuted}`}>
        Tip: <span className="text-(--acid)">{'${1:name}'}</span> = tab stop,{' '}
        <span className="text-(--acid)">$0</span> = final cursor position
      </p>
      {error && <p className="text-[12px] font-bold text-(--red)">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={`${t.btnGhost} px-4 py-2 text-[13px]`}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${t.btnPrimary} px-4 py-2 text-[13px] flex items-center gap-1.5`}
        >
          <Save size={14} />
          {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );
}

export default function SnippetManager({ theme, language, onInsert, onClose, initialCode }) {
  const t = getThemeClasses(theme);
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [langFilter, setLangFilter] = useState(language || 'all');
  const [showCustomOnly, setShowCustomOnly] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | snippet
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const items = await getSnippets({
        language: langFilter === 'all' ? undefined : langFilter,
        q: query || undefined,
      });
      setSnippets(items);
    } catch {
      setSnippets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // If opened with selected code, jump straight to the create form
  useEffect(() => {
    if (initialCode) setEditing('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!showCustomOnly) return snippets;
    return snippets.filter((s) => !s.isBuiltIn);
  }, [snippets, showCustomOnly]);

  const categories = useMemo(() => {
    const set = new Set(filtered.map((s) => s.category).filter(Boolean));
    return [...set].sort();
  }, [filtered]);

  const handleSave = async (form) => {
    const payload = initialCode && editing === 'new' ? { ...form, code: initialCode } : form;
    if (editing && editing !== 'new') {
      await updateSnippet(editing._id, payload);
    } else {
      await createSnippet(payload);
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this snippet?')) return;
    await deleteSnippet(id);
    load();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`${t.card} relative w-[720px] max-w-full max-h-[85vh] flex flex-col overflow-hidden animate-fade-in`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.border} shrink-0`}>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-(--acid)/15 border border-(--acid)/30 flex items-center justify-center">
              <Code2 size={15} className="text-(--acid)" />
            </span>
            <div>
              <h2 className={`text-[15px] font-extrabold ${t.textPrimary}`}>Snippets</h2>
              <p className={`font-mono text-[11px] ${t.textMuted}`}>
                {filtered.length} snippet{filtered.length !== 1 ? 's' : ''} · type prefix + Tab in editor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing('new')}
              className={`${t.btnPrimary} px-3 py-1.5 text-[12px] flex items-center gap-1.5`}
            >
              <Plus size={13} /> New
            </button>
            <button onClick={onClose} className={t.iconBtn} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="p-5 overflow-y-auto custom-scrollbar">
            <SnippetForm
              theme={theme}
              initial={editing === 'new' ? (initialCode ? { code: initialCode } : null) : editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className={`flex items-center gap-2 px-5 py-3 border-b ${t.border} shrink-0 flex-wrap`}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${t.border} bg-(--panel) flex-1 min-w-[180px]`}>
                <Search size={13} className={t.textMuted} />
                <input
                  className={`bg-transparent outline-none text-[13px] ${t.textPrimary} w-full font-mono`}
                  placeholder="Search snippets…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLangFilter(l)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold border transition-colors ${
                    langFilter === l
                      ? 'bg-(--ink) text-(--paper) border-(--ink)'
                      : `${t.border} ${t.textMuted} hover:text-(--ink)`
                  }`}
                >
                  {l === 'all' ? 'All' : LANG_LABEL[l]}
                </button>
              ))}
              <button
                onClick={() => setShowCustomOnly((v) => !v)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                  showCustomOnly
                    ? 'bg-(--acid)/20 border-(--acid)/40 text-(--acid)'
                    : `${t.border} ${t.textMuted}`
                }`}
              >
                <Sparkles size={11} /> Mine
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {loading ? (
                <p className={`text-center py-10 text-[13px] ${t.textMuted}`}>Loading snippets…</p>
              ) : filtered.length === 0 ? (
                <div className={`flex flex-col items-center gap-2 py-12 ${t.textMuted}`}>
                  <Code2 size={28} />
                  <p className="text-[13px]">No snippets found</p>
                  <button
                    onClick={() => setEditing('new')}
                    className={`${t.btnGhost} px-3 py-1.5 text-[12px] mt-1`}
                  >
                    Create your first snippet
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filtered.map((s) => {
                    const isOpen = expanded === s._id;
                    return (
                      <div
                        key={s._id}
                        className={`rounded-xl border ${t.border} bg-(--panel) overflow-hidden transition-colors ${
                          isOpen ? 'border-(--blue)/40' : ''
                        }`}
                      >
                        <button
                          onClick={() => setExpanded(isOpen ? null : s._id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                        >
                          <ChevronRight
                            size={14}
                            className={`${t.textMuted} transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                          <code className="font-mono text-[13px] font-extrabold text-(--blue) bg-(--blue)/10 px-1.5 py-0.5 rounded">
                            {s.prefix}
                          </code>
                          <span className={`text-[13px] font-bold ${t.textPrimary} flex-1 truncate`}>
                            {s.name}
                          </span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${LANG_COLOR[s.language] || ''}`}>
                            {LANG_LABEL[s.language] || s.language}
                          </span>
                          {!s.isBuiltIn && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-(--acid)/40 bg-(--acid)/10 text-(--acid)">
                              custom
                            </span>
                          )}
                        </button>
                        {isOpen && (
                          <div className={`px-4 pb-3 pt-1 border-t ${t.border} animate-fade-in`}>
                            {s.description && (
                              <p className={`text-[12px] ${t.textMuted} mb-2`}>{s.description}</p>
                            )}
                            <pre className={`font-mono text-[12px] leading-relaxed p-3 rounded-lg bg-black/30 border ${t.border} overflow-x-auto custom-scrollbar whitespace-pre`}>
                              {s.code}
                            </pre>
                            <div className="flex items-center justify-between mt-2.5">
                              <span className={`font-mono text-[10px] ${t.textMuted}`}>
                                {s.category} · used {s.useCount || 0}×
                              </span>
                              <div className="flex items-center gap-1.5">
                                {!s.isBuiltIn && (
                                  <>
                                    <button
                                      onClick={() => setEditing(s)}
                                      title="Edit"
                                      className={`${t.iconBtn} p-1.5!`}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(s._id)}
                                      title="Delete"
                                      className={`${t.iconBtn} p-1.5! hover:text-(--red)!`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => onInsert(s)}
                                  className={`${t.btnPrimary} px-3 py-1.5 text-[12px]`}
                                >
                                  Insert
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {categories.length > 0 && (
                <p className={`font-mono text-[10px] ${t.textMuted} px-2 pt-3`}>
                  categories: {categories.join(' · ')}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
