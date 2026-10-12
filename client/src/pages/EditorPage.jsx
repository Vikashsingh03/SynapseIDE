import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileProvider } from '../contexts/FileContext';
import { useAuth } from '../context/useAuth';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import EditorPanel from '../components/EditorPanel';
import Toolbar from '../components/Toolbar';
import OutputPanel from '../components/OutputPanel';
import StatusBar from '../components/StatusBar';
import NeuraPanel from '../components/NeuraPanel';
import CommandPalette from '../components/CommandPalette';
import { useEditorSettings } from '../hooks/useEditorSettings';
import { readStorage, writeStorage } from '../utils/storage';
import { getThemeClasses } from '../utils/theme';

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
  } = useEditorSettings();

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
      <div
        className={`flex flex-col h-screen w-screen overflow-hidden ${t.page} relative`}
        data-theme={theme}
      >
        {/* Subtle ambient glow behind the workspace */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-32 left-1/3 w-2xl h-88 rounded-full bg-violet-600/10 blur-[130px] animate-aurora" />
          <div className="absolute -bottom-40 -right-24 w-xl h-80 rounded-full bg-cyan-500/[0.07] blur-[130px] animate-aurora" style={{ animationDelay: '-12s' }} />
        </div>

        {/* Top Toolbar */}
        <div className="relative z-50 animate-fade-in">
          <Toolbar
            theme={theme}
            onToggleTheme={toggleTheme}
            setOutput={setOutput}
            onExit={handleExit}
            currentUser={user}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        </div>

        {/* Main content area */}
        <div className="relative z-10 flex flex-1 overflow-hidden p-2.5 gap-2.5 min-h-0">
          {/* Sidebar */}
          <div className="animate-fade-up flex shrink-0 min-h-0" style={{ animationDelay: '60ms' }}>
            <Sidebar theme={theme} />
          </div>

          {/* Editor + Output */}
          <div
            className="animate-fade-up flex flex-col flex-1 min-w-0 overflow-hidden rounded-2xl border shadow-2xl min-h-0"
            style={{ animationDelay: '120ms' }}
          >
            <div className={`${t.editorBg} flex flex-col flex-1 min-h-0 rounded-2xl overflow-hidden border ${t.border}`}>
              {/* Tab bar */}
              <TabBar theme={theme} />

              {/* Editor */}
              <EditorPanel theme={theme} editorSettings={editorSettings} />

              {/* Output */}
              <OutputPanel theme={theme} output={output} />
            </div>
          </div>

          {/* Neura AI Sidebar */}
          <div className="animate-fade-up flex shrink-0 min-h-0" style={{ animationDelay: '180ms' }}>
            <NeuraPanel theme={theme} />
          </div>
        </div>

        {/* Status Bar */}
        <div className="relative z-40 animate-fade-in" style={{ animationDelay: '240ms' }}>
          <StatusBar theme={theme} peersCount={0} />
        </div>

        {/* ⌘K Command Palette */}
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
        />
      </div>
    </FileProvider>
  );
}

export default EditorPage;
