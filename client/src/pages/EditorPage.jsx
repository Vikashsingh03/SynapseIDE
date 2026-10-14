import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelLeft, Sparkles, X } from 'lucide-react';
import { FileProvider } from '../contexts/FileContext';
import { useAuth } from '../context/useAuth';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import EditorPanel from '../components/EditorPanel';
import Toolbar from '../components/Toolbar';
import OutputPanel from '../components/OutputPanel';
import SnippetHost from '../components/SnippetHost';
import { ProjectTemplatesHost } from '../components/ProjectTemplatesModal';
import { PracticeHost } from '../components/PracticePanel';
import Breadcrumbs from '../components/Breadcrumbs';
import { RenameSymbolHost } from '../components/RenameSymbolModal';
import { DebugHost } from '../components/DebugPanel';
import { ExtensionsHost } from '../components/ExtensionsPanel';
import { NotebookHost } from '../components/NotebookPanel';
import StatusBar from '../components/StatusBar';
import NeuraPanel from '../components/NeuraPanel';
import CommandPalette from '../components/CommandPalette';
import CodeReviewModal from '../components/CodeReviewModal';
import { useEditorSettings } from '../hooks/useEditorSettings';
import { readStorage, writeStorage } from '../utils/storage';
import { getThemeClasses } from '../utils/theme';
import { useFiles } from '../contexts/FileContext';

/** Editor column of the IDE frame: tabs, breadcrumbs, editor (+split), output.
 *  Lives inside <FileProvider> so it can read openTabs/activeFileId/files. */
function EditorWorkspace({ theme, editorSettings, output }) {
  const { openTabs, activeFileId, files } = useFiles();
  const [splitOn, setSplitOn] = useState(false);
  const [splitFileId, setSplitFileId] = useState(null);

  // Split toggle dispatched from TabBar's Columns2 button
  useEffect(() => {
    const toggle = () => {
      if (!splitOn && !splitFileId) {
        // Default the split pane to the most recent other open tab,
        // else the first file that isn't the active one.
        const recentOther = [...openTabs].reverse().find((id) => id !== activeFileId);
        const fallback = files.find((f) => f.id !== activeFileId)?.id || null;
        setSplitFileId(recentOther || fallback);
      }
      setSplitOn((v) => !v);
    };
    window.addEventListener('synapse:toggle-split', toggle);
    return () => window.removeEventListener('synapse:toggle-split', toggle);
  }, [openTabs, activeFileId, files, splitOn, splitFileId]);

  return (
    <div
      className="flex flex-col flex-1 min-w-0 overflow-hidden rounded-xl border border-[#2b3546] bg-[#121824] min-h-0"
    >
      {/* Tab bar */}
      <TabBar theme={theme} showSplit splitActive={splitOn} />
      <Breadcrumbs />

      {/* Editor row: primary + optional split pane */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <EditorPanel theme={theme} editorSettings={editorSettings} />
        </div>
        {splitOn && (
          <>
            <div className="w-px shrink-0 bg-white/8" />
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Split file strip: pick which file the second pane shows */}
              <div className="h-[30px] flex items-center gap-2 px-2 bg-[#0D1220] border-b border-white/[0.06] shrink-0">
                <select
                  value={splitFileId || ''}
                  onChange={(e) => setSplitFileId(e.target.value || null)}
                  className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-[#C9D4E6] outline-none cursor-pointer"
                  aria-label="Split pane file"
                >
                  {openTabs.map((id) => {
                    const f = files.find((x) => x.id === id);
                    if (!f) return null;
                    return (
                      <option key={id} value={id} className="bg-[#0D1220]">
                        {f.name}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => setSplitOn(false)}
                  className="p-1 rounded text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close split"
                  aria-label="Close split editor"
                >
                  <X size={13} />
                </button>
              </div>
              <EditorPanel
                theme={theme}
                editorSettings={editorSettings}
                fileIdOverride={splitFileId}
                isPrimary={false}
              />
            </div>
          </>
        )}
      </div>

      {/* Output */}
      <OutputPanel theme={theme} output={output} />
    </div>
  );
}

function EditorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [theme, setTheme] = useState(() => {
    return readStorage('synapse-theme') || 'dark';
  });

  const [output, setOutput] = useState({
    stdout: '',
    stderr: '',
    compile_output: '',
    status: null,
    error: null,
    running: false,
  });

  // ── Tadka pack: command palette + editor personalization ──
  const [paletteOpen, setPaletteOpen] = useState(false);
  const {
    settings: editorSettings,
    increaseFont,
    decreaseFont,
    toggleWordWrap,
    toggleMinimap,
    cycleEditorTheme,
    cycleFontFamily,
    cycleTabSize,
    toggleFormatOnType,
    toggleStickyScroll,
  } = useEditorSettings();

  // ── Advanced pack: Neura code review modal + zen mode ──
  const [reviewOpen, setReviewOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  // ── Mobile: slide-over drawers for sidebar + Neura ──
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileNeuraOpen, setMobileNeuraOpen] = useState(false);

  useEffect(() => {
    const openReview = () => setReviewOpen(true);
    const toggleZen = () => setZenMode((v) => !v);
    const cycleTheme = () => cycleEditorTheme();
    window.addEventListener('synapse:review-code', openReview);
    window.addEventListener('synapse:toggle-zen', toggleZen);
    window.addEventListener('synapse:cycle-editor-theme', cycleTheme);
    return () => {
      window.removeEventListener('synapse:review-code', openReview);
      window.removeEventListener('synapse:toggle-zen', toggleZen);
      window.removeEventListener('synapse:cycle-editor-theme', cycleTheme);
    };
  }, [cycleEditorTheme]);

  useEffect(() => {
    const onKey = (e) => {
      const isK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey;
      const isVSCodeStyle = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p';
      if (isK || isVSCodeStyle) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // TitleBar command-center box + Empty State rows open the palette via event
  useEffect(() => {
    const open = () => setPaletteOpen(true);
    window.addEventListener('synapse:open-palette', open);
    return () => window.removeEventListener('synapse:open-palette', open);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    writeStorage('synapse-theme', newTheme);
  };

  const handleExit = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const t = getThemeClasses(theme);

  return (
    <FileProvider>
      <style>{`
        @keyframes syn-slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes syn-slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes syn-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .syn-drawer-left { animation: syn-slide-in-left 0.22s ease-out; }
        .syn-drawer-right { animation: syn-slide-in-right 0.22s ease-out; }
        .syn-drawer-fade { animation: syn-fade-in 0.18s ease-out; }
      `}</style>
      <div
        className={`flex flex-col h-screen w-screen overflow-hidden ${t.page}`}
        data-theme={theme}
      >
        {/* Top Toolbar */}
        <div className="relative z-50 shrink-0">
          <Toolbar
            theme={theme}
            onToggleTheme={toggleTheme}
            setOutput={setOutput}
            onExit={handleExit}
            currentUser={user}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenReview={() => setReviewOpen(true)}
          />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden p-2 gap-2 min-h-0">
          {/* Sidebar — desktop inline, mobile drawer */}
          {!zenMode && (
            <>
              <div className="hidden md:flex shrink-0 min-h-0">
                <Sidebar theme={theme} />
              </div>
              {mobileSidebarOpen && (
                <div className="fixed inset-0 z-70 md:hidden">
                  <div
                    className="absolute inset-0 bg-black/60 syn-drawer-fade"
                    onClick={() => setMobileSidebarOpen(false)}
                  />
                  <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] syn-drawer-left">
                    <div className="relative h-full flex">
                      <Sidebar theme={theme} />
                      <button
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-label="Close files"
                        className={`absolute top-3 right-3 p-1.5 rounded-md border ${t.border} bg-(--panel) ${t.textMuted} hover:text-(--ink)`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Editor + Output — dark IDE frame (always dark, like a real IDE) */}
          <EditorWorkspace theme={theme} editorSettings={editorSettings} output={output} />

          {/* Neura AI Sidebar — desktop inline, mobile drawer */}
          {!zenMode && (
            <>
              <div className="hidden md:flex shrink-0 min-h-0">
                <NeuraPanel theme={theme} />
              </div>
              {mobileNeuraOpen && (
                <div className="fixed inset-0 z-70 md:hidden">
                  <div
                    className="absolute inset-0 bg-black/60 syn-drawer-fade"
                    onClick={() => setMobileNeuraOpen(false)}
                  />
                  <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] syn-drawer-right">
                    <div className="relative h-full flex">
                      <NeuraPanel
                        theme={theme}
                        forceOpen
                        onClose={() => setMobileNeuraOpen(false)}
                      />
                      <button
                        onClick={() => setMobileNeuraOpen(false)}
                        aria-label="Close Neura AI"
                        className={`absolute top-3 right-3 p-1.5 rounded-md border ${t.border} bg-(--panel) ${t.textMuted} hover:text-(--ink)`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status Bar — hidden in zen mode */}
        {!zenMode && (
          <div className="shrink-0 overflow-x-auto">
            <StatusBar contextLabel="Solo workspace" />
          </div>
        )}

        {/* Mobile floating buttons: files + Neura */}
        {!zenMode && (
          <div className="md:hidden fixed bottom-16 left-3 z-40 flex flex-col gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open files"
              className="w-11 h-11 rounded-xl bg-(--red) text-white flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.35)] active:scale-95 transition-transform"
            >
              <PanelLeft size={18} />
            </button>
            <button
              onClick={() => setMobileNeuraOpen(true)}
              aria-label="Open Neura AI"
              className="w-11 h-11 rounded-xl bg-(--blue) text-white flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.35)] active:scale-95 transition-transform"
            >
              <Sparkles size={18} />
            </button>
          </div>
        )}

        {/* Command Palette */}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onExit={handleExit}
          settings={editorSettings}
          onIncreaseFont={increaseFont}
          onDecreaseFont={decreaseFont}
          onToggleWordWrap={toggleWordWrap}
          onToggleMinimap={toggleMinimap}
          onCycleFontFamily={cycleFontFamily}
          onCycleTabSize={cycleTabSize}
          onToggleFormatOnType={toggleFormatOnType}
          onToggleStickyScroll={toggleStickyScroll}
          onOpenReview={() => setReviewOpen(true)}
        />

        <SnippetHost theme={theme} />
        <ProjectTemplatesHost theme={theme} />
        <PracticeHost theme={theme} />
        <RenameSymbolHost />
                <DebugHost />
        <ExtensionsHost />
        <NotebookHost />

        {/* Neura code review modal */}
        <CodeReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          theme={theme}
        />
      </div>
    </FileProvider>
  );
}

export default EditorPage;
