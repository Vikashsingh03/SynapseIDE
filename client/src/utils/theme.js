





export function getThemeClasses(theme) {
  const dark = theme === 'dark';

  return {
     
    bg: dark ? 'bg-[#111310]' : 'bg-[#f3f1eb]',
    header: dark
      ? 'bg-[#111310]/90 backdrop-blur-md border-b border-[#343730]'
      : 'bg-[#f3f1eb]/90 backdrop-blur-md border-b border-[#d6d4cc]',
    sidebar: dark
      ? 'bg-[#171916] border-r border-[#343730]'
      : 'bg-[#faf9f5] border-r border-[#d6d4cc]',
    border: dark ? 'border-[#343730]' : 'border-[#d6d4cc]',
    text: dark ? 'text-[#a8aba3]' : 'text-[#60635d]',
    textMuted: dark ? 'text-[#6b6e66]' : 'text-[#8a8d85]',
    tabActive: dark ? 'text-[#f3f2ec]' : 'text-[#141514]',
    tabInactive: dark
      ? 'text-[#6b6e66] hover:text-[#a8aba3]'
      : 'text-[#8a8d85] hover:text-[#60635d]',
    
    editorBg: 'bg-[#121824]',
    consoleHeader: 'bg-[#182131] border-b border-[#283348]',

     
    page: dark ? 'bg-[#111310] text-[#a8aba3]' : 'bg-[#f3f1eb] text-[#60635d]',

    card: dark
      ? 'bg-[#1b1d19] border border-[#343730] rounded-lg shadow-[0_8px_26px_rgba(0,0,0,0.28)]'
      : 'bg-white border border-[#d6d4cc] rounded-lg shadow-[0_8px_26px_rgba(20,21,20,0.08)]',

    cardHover: dark ? 'hover:border-[#4a4d44]' : 'hover:border-[#b9b7ad]',

    textPrimary: dark ? 'text-[#f3f2ec]' : 'text-[#141514]',
    textSecondary: dark ? 'text-[#a8aba3]' : 'text-[#60635d]',
    textMuted2: dark ? 'text-[#6b6e66]' : 'text-[#8a8d85]',

    eyebrow:
      'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ' +
      (dark ? 'text-[#8a8d85]' : 'text-[#8a8d85]'),
    divider: dark ? 'border-[#343730]' : 'border-[#d6d4cc]',

    input: dark
      ? 'w-full rounded-lg bg-[#171916] border border-[#343730] px-3 py-2 text-sm text-[#f3f2ec] placeholder:text-[#6b6e66] outline-none focus:border-[#1557ff] transition-colors'
      : 'w-full rounded-lg bg-white border border-[#d6d4cc] px-3 py-2 text-sm text-[#141514] placeholder:text-[#8a8d85] outline-none focus:border-[#1557ff] transition-colors',

    
    btnPrimary: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold text-[#111310] bg-[#f3f2ec] border border-[#f3f2ec] hover:-translate-y-px transition-all duration-200 cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold text-[#faf9f5] bg-[#141514] border border-[#141514] hover:-translate-y-px transition-all duration-200 cursor-pointer',

    
    btnAccent:
      'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold text-white bg-[#ff4d35] border border-[#141514] shadow-[4px_4px_0_#141514] hover:shadow-[6px_6px_0_#141514] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_#141514] transition-all duration-200 cursor-pointer',

    btnSecondary: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#a8aba3] bg-transparent border border-[#343730] hover:text-[#f3f2ec] hover:border-[#4a4d44] transition-colors cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#60635d] bg-transparent border border-[#d6d4cc] hover:text-[#141514] hover:border-[#b9b7ad] transition-colors cursor-pointer',

    btnGhost: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#a8aba3] hover:text-[#f3f2ec] hover:bg-white/5 transition-colors cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#60635d] hover:text-[#141514] hover:bg-black/4 transition-colors cursor-pointer',

    btnDanger: dark
      ? 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#ff8a75] bg-[#ff4d35]/10 border border-[#ff4d35]/30 hover:bg-[#ff4d35] hover:text-white transition-colors cursor-pointer'
      : 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#d93824] bg-[#ff4d35]/7 border border-[#ff4d35]/25 hover:bg-[#ff4d35] hover:text-white transition-colors cursor-pointer',

    
    btnRun:
      'inline-flex items-center justify-center gap-2 rounded-[5px] px-3 py-1.5 font-mono text-[11px] font-bold text-[#10140b] bg-[#d9ff3f] border border-[#1e2411] shadow-[0_0_18px_rgba(217,255,63,0.35)] hover:shadow-[0_0_26px_rgba(217,255,63,0.5)] hover:brightness-105 active:brightness-95 transition-all cursor-pointer',

    badge: dark
      ? 'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold bg-white/6 border border-[#343730] text-[#a8aba3]'
      : 'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold bg-black/4 border border-[#d6d4cc] text-[#60635d]',

    chip: dark
      ? 'rounded px-1.5 py-0.5 font-mono text-[11px] bg-white/6 border border-[#343730] text-[#a8aba3]'
      : 'rounded px-1.5 py-0.5 font-mono text-[11px] bg-black/4 border border-[#d6d4cc] text-[#60635d]',

    iconBtn: dark
      ? 'p-2 rounded-lg text-[#6b6e66] hover:text-[#f3f2ec] hover:bg-white/6 transition-colors cursor-pointer'
      : 'p-2 rounded-lg text-[#8a8d85] hover:text-[#141514] hover:bg-black/5 transition-colors cursor-pointer',

    liveDot: 'relative flex h-2 w-2',

    kbd: dark
      ? 'rounded-[7px] border border-[#343730] bg-white/4 px-1.5 py-0.5 font-mono text-[10px] text-[#8a8d85]'
      : 'rounded-[7px] border border-[#d6d4cc] bg-black/3 px-1.5 py-0.5 font-mono text-[10px] text-[#8a8d85]',

    modalOverlay:
      'fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[5px] animate-fade-in',
    modalCard: dark
      ? 'bg-[#1b1d19] rounded-xl w-full max-w-md border border-[#343730] shadow-[0_30px_90px_rgba(0,0,0,0.5)] animate-spring-in'
      : 'bg-white rounded-xl w-full max-w-md border border-[#d6d4cc] shadow-[0_30px_90px_rgba(20,21,20,0.2)] animate-spring-in',
  };
}
