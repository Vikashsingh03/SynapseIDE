/**
 * Synapse premium theme tokens ("Obsidian Pulse").
 * Every key returns a complete Tailwind class string for the active theme.
 * Legacy keys are preserved so old components keep working.
 */
export function getThemeClasses(theme) {
  const dark = theme === 'dark';

  return {
    /* ── legacy keys (kept for compatibility) ── */
    bg: dark ? 'bg-[#050508]' : 'bg-slate-50',
    header: dark
      ? 'bg-[#0a0a14]/75 backdrop-blur-xl border-b border-white/[0.07]'
      : 'bg-white/80 backdrop-blur-xl border-b border-slate-200',
    sidebar: dark ? 'bg-white/[0.02] border-r border-white/[0.07]' : 'bg-slate-100 border-r border-slate-200',
    border: dark ? 'border-white/10' : 'border-slate-200',
    text: dark ? 'text-slate-300' : 'text-slate-600',
    textMuted: dark ? 'text-slate-500' : 'text-slate-400',
    tabActive: dark
      ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
      : 'bg-white text-slate-900 shadow-sm',
    tabInactive: dark
      ? 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
      : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-600',
    editorBg: dark ? 'bg-[#050508]' : 'bg-white',
    consoleHeader: dark ? 'bg-white/[0.03] border-b border-white/[0.07]' : 'bg-slate-100 border-b border-slate-200',

    /* ── premium tokens ── */
    page: dark ? 'bg-[#050508] text-slate-200' : 'bg-[#f4f5fa] text-slate-700',

    glass: dark ? 'syn-glass' : 'syn-glass',

    card: dark
      ? 'bg-white/[0.03] border border-white/[0.08] rounded-2xl'
      : 'bg-white border border-slate-200/90 rounded-2xl shadow-[0_10px_36px_-16px_rgba(15,23,42,0.14)]',

    cardHover: 'syn-card-hover',

    textPrimary: dark ? 'text-slate-100' : 'text-slate-900',
    textSecondary: dark ? 'text-slate-400' : 'text-slate-500',
    textMuted2: dark ? 'text-slate-600' : 'text-slate-400',

    textGradient: 'syn-text-gradient',
    eyebrow: 'syn-eyebrow',
    divider: 'syn-divider',

    input: dark
      ? 'syn-input rounded-xl'
      : 'syn-input rounded-xl',

    btnPrimary:
      'syn-btn-primary rounded-xl px-5 py-3 text-sm font-semibold',

    btnSecondary: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-200 bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm',

    btnGhost: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] active:scale-[0.98] transition-all duration-200 cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-[0.98] transition-all duration-200 cursor-pointer',

    btnDanger: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-600 hover:text-white hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer',

    badge: dark
      ? 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold bg-violet-500/10 border border-violet-500/25 text-violet-300'
      : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold bg-violet-50 border border-violet-200 text-violet-700',

    chip: dark
      ? 'rounded-md px-2 py-0.5 text-[11px] font-mono bg-white/[0.06] border border-white/10 text-slate-400'
      : 'rounded-md px-2 py-0.5 text-[11px] font-mono bg-slate-100 border border-slate-200 text-slate-500',

    iconBtn: dark
      ? 'p-2 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-white/[0.07] active:scale-95 transition-all duration-150 cursor-pointer'
      : 'p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all duration-150 cursor-pointer',

    liveDot: 'relative flex h-2 w-2',

    kbd: dark
      ? 'rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-mono text-slate-400'
      : 'rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500',

    modalOverlay:
      'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in',
    modalCard: dark
      ? 'syn-glass-strong rounded-2xl p-8 w-full max-w-md shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)] animate-scale-in'
      : 'bg-white rounded-2xl p-8 w-full max-w-md shadow-[0_32px_80px_-16px_rgba(15,23,42,0.3)] border border-slate-200 animate-scale-in',
  };
}
