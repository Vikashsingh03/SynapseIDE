import { Zap, Command, LayoutTemplate, Trophy } from 'lucide-react';

/**
 * EditorEmptyState — premium VS Code-style watermark shown when no file
 * is open. Replaces the plain "No file open" text.
 *
 * Clickable rows dispatch real window events (the host pages wire these):
 *   'synapse:open-palette'   → command palette
 *   'synapse:new-project'     → project templates modal
 *   'synapse:open-practice'  → Practice Arena
 */

const ACTIONS = [
  {
    key: 'palette',
    label: 'Command Palette',
    icon: Command,
    chip: 'kbd',
    kbd: 'Ctrl K',
    onClick: () => window.dispatchEvent(new Event('synapse:open-palette')),
  },
  {
    key: 'template',
    label: 'New Project from Template',
    icon: LayoutTemplate,
    chip: 'icon',
    onClick: () => window.dispatchEvent(new Event('synapse:new-project')),
  },
  {
    key: 'practice',
    label: 'Practice Coding Problems',
    icon: Trophy,
    chip: 'icon',
    onClick: () => window.dispatchEvent(new Event('synapse:open-practice')),
  },
];

// Shortcuts verified to exist in this codebase (non-clickable reference).
const SHORTCUTS = [
  { label: 'Command Palette', kbd: 'Ctrl K' },
  { label: 'Search & Replace', kbd: 'Ctrl ⇧ F' },
  { label: 'Rename File', kbd: 'F2' },
  { label: 'Auto-save', kbd: 'as you type' },
];

function Kbd({ children }) {
  return (
    <span className="font-mono text-[11px] text-[#7C8DB0] bg-white/[0.05] border border-white/10 rounded-md px-1.5 py-0.5 whitespace-nowrap">
      {children}
    </span>
  );
}

export default function EditorEmptyState() {
  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden bg-[#0A0E17] select-none animate-fade-in">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_38%,rgba(88,166,255,0.08),transparent_70%)] pointer-events-none" />
      {/* Faint grid for depth */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="relative flex flex-col items-center gap-7 px-6">
        {/* App mark */}
        <div className="flex flex-col items-center gap-4">
          <div className="p-[1px] rounded-2xl bg-gradient-to-br from-[#D9FF3F]/50 via-[#58A6FF]/25 to-transparent shadow-[0_0_44px_rgba(217,255,63,0.10)]">
            <div className="w-16 h-16 rounded-2xl bg-[#0E1626] flex items-center justify-center">
              <Zap size={30} className="text-[#D9FF3F]" strokeWidth={2.2} />
            </div>
          </div>
          <span className="tracking-[0.35em] pl-[0.35em] text-[13px] text-[#5F7194] font-semibold">
            SYNAPSE
          </span>
        </div>

        {/* Action rows */}
        <div className="flex flex-col gap-1">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              className="group w-[340px] max-w-[80vw] flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] text-[#A9BCDC] hover:bg-white/[0.04] hover:text-[#D7E2F2] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <a.icon size={15} className="text-[#5F7194] group-hover:text-[#D9FF3F] transition-colors" />
                {a.label}
              </span>
              {a.chip === 'kbd' ? <Kbd>{a.kbd}</Kbd> : <a.icon size={14} className="text-[#3D4A66]" />}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-[340px] max-w-[80vw] h-px bg-white/[0.06]" />

        {/* Verified shortcuts reference */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-2.5">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4 text-[12px]">
              <span className="text-[#55688C]">{s.label}</span>
              <Kbd>{s.kbd}</Kbd>
            </div>
          ))}
        </div>

        {/* Tip */}
        <p className="font-mono text-[11.5px] text-[#55688C] text-center max-w-[420px]">
          Tip: type <span className="text-[#D9FF3F]/80">rfce</span> in any .jsx file for a full React component
        </p>
      </div>
    </div>
  );
}
