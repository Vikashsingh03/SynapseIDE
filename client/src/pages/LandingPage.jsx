import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ChevronDown,
  Cpu,
  GitBranch,
  LayoutDashboard,
  Layers,
  LogOut,
  Play,
  Quote,
  ShieldCheck,
  Star,
  Terminal,
  Users2,
  UserRound,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';
import { getThemeClasses } from '../utils/theme';
import { readStorage } from '../utils/storage';
import SynapseLogo from '../components/SynapseLogo';
import { Reveal } from '../hooks/useReveal';
import AnimatedCounter from '../components/AnimatedCounter';

function NavItem({ href, children }) {
  return (
    <a
      href={href}
      className="py-1.5 text-sm font-semibold text-(--muted) transition-colors duration-150 hover:text-(--ink)"
    >
      {children}
    </a>
  );
}

function getDisplayName(user) {
  if (!user) {
    return 'Log in';
  }

  return user.name || user.username || user.fullName || user.email?.split('@')[0] || 'Account';
}

const collaborationHighlights = [
  {
    icon: Users2,
    title: 'Instant shared workspaces',
    description:
      'Create a room, invite teammates, and collaborate with live sync from any browser.',
  },
  {
    icon: Layers,
    title: 'One loop for code, review, and run',
    description:
      'Edit together, review changes live, and run code without switching tools.',
  },
  {
    icon: Cpu,
    title: 'AI support for faster delivery',
    description:
      'Use built-in AI to explain logic, catch issues early, and ship with confidence.',
  },
];

const trustStats = [
  { prefix: '<', countTo: 20, suffix: 'ms', label: 'collaboration sync', detail: 'Fast room presence and shared edits.' },
  { countTo: 12, suffix: '+', label: 'languages ready', detail: 'Run code across common interview and project stacks.' },
  { value: '24/7', label: 'workspace access', detail: 'Join sessions instantly from the browser.' },
  { value: 'AI-native', label: 'review workflow', detail: 'Get context-aware assistance without leaving the IDE.' },
];

const techStack = [
  'React 19',
  'Yjs CRDT',
  'Socket.IO',
  'Monaco Editor',
  'MongoDB',
  'Groq AI',
  'Tailwind CSS',
  'Node.js',
];

const useCases = [
  {
    icon: Terminal,
    title: 'Interview Practice',
    description: 'Run live interviews and pair sessions in a ready-to-code browser workspace.',
  },
  {
    icon: GitBranch,
    title: 'Team Pairing',
    description: 'Resolve bugs, review code, and make decisions together in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Classrooms And Labs',
    description: 'Give students one browser workspace for coding, execution, and guided AI help.',
  },
];

const testimonials = [
  {
    quote:
      'Synapse removed setup overhead. We moved from screen-sharing to true collaboration.',
    name: 'Riya Sharma',
    role: 'Engineering Lead, BuildLab',
  },
  {
    quote:
      'The AI feels native to the editor and helps us review faster without breaking flow.',
    name: 'Aditya Mehta',
    role: 'Product Engineer, SprintForge',
  },
  {
    quote:
      'For mentoring and demos, sending one room link is much easier than fixing local setups.',
    name: 'Neha Verma',
    role: 'Instructor, CodeCircle',
  },
];

const faqItems = [
  {
    question: 'Do users need to install anything before joining?',
    answer: 'No. Synapse is browser-first, so users can join and start coding immediately.',
  },
  {
    question: 'Is this useful only for teams?',
    answer: 'No. It works for interviews, classrooms, mentoring sessions, and solo work too.',
  },
  {
    question: 'What makes the AI experience different?',
    answer: 'The assistant lives inside the editor, so you can ask in context while coding.',
  },
];

const footerGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Preview', href: '#preview' },
      { label: 'Use Cases', href: '#use-cases' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '#workflow' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Status', href: '#footer' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Privacy', href: '#footer' },
      { label: 'Terms', href: '#footer' },
      { label: 'Security', href: '#footer' },
    ],
  },
];

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme] = useState(() => readStorage('synapse-theme') || 'dark');
  const { isAuthenticated, user, logout } = useAuth();
  const t = getThemeClasses(theme);
  const displayName = getDisplayName(user);
  const initials = getUserInitial(user);
  const userAvatarStyle = getAvatarStyle(user);

  
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#111310' : '#f3f1eb';

    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className={`${t.page} syn-grain min-h-screen overflow-x-hidden`} data-theme={theme}>
      <header
        className={`fixed left-0 top-0 z-50 w-full transition-colors duration-150 ${isScrolled
          ? t.header
          : 'border-b border-transparent bg-transparent'
          }`}
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 justify-self-start" aria-label="Synapse home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--red)">
              <SynapseLogo size={18} color="#ffffff" nodeColor="#ffffff" />
            </span>
            <span className="text-[17px] font-extrabold tracking-tight text-(--ink)">
              Synapse
            </span>
          </Link>

          <nav className="hidden items-center justify-center gap-8 lg:flex">
            <NavItem href="#features">Features</NavItem>
            <NavItem href="#workflow">How It Works</NavItem>
            <NavItem href="#preview">Preview</NavItem>
            <NavItem href="#faq">FAQ</NavItem>
          </nav>

          <div className="flex items-center justify-self-end gap-2">
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className={`${t.btnGhost} hidden sm:inline-flex`}
                aria-label="Open dashboard"
                title="Dashboard"
              >
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </Link>
            )}

            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border ${t.border} bg-(--panel) py-1 pl-1 pr-2 transition-colors hover:border-(--blue)`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={userAvatarStyle}
                  >
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className={`block text-sm font-bold max-w-40 truncate ${t.textPrimary}`}>{displayName}</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`${t.textMuted2} transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className={`absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border ${t.border} bg-(--paper) p-1.5 shadow-[6px_6px_0_var(--ink)] animate-fade-in`}
                  >
                    <div className={`mb-1.5 border-b px-3 py-2.5 ${t.divider}`}>
                      <p className={`truncate text-sm font-extrabold ${t.textPrimary}`}>{displayName}</p>
                      {user?.email && (
                        <p className={`mt-0.5 truncate font-mono text-xs ${t.textMuted2}`}>{user.email}</p>
                      )}
                    </div>
                    <Link
                      to="/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${t.textSecondary} hover:bg-(--ink)/5 hover:text-(--ink) sm:hidden`}
                    >
                      <LayoutDashboard size={15} />
                      Dashboard
                    </Link>
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); logout(); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold text-(--red) transition-colors hover:bg-(--red)/10"
                    >
                      <LogOut size={15} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className={t.btnSecondary}>
                <UserRound size={15} />
                <span>Log in</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        { }
        <section className="relative px-5 pb-16 pt-32 sm:px-6 sm:pt-40 lg:px-8">
          <div className="syn-paper-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
            <div className="animate-hero-in stagger-1 mb-7 inline-flex items-center gap-2.5 rounded-full border border-(--line) bg-(--panel) px-4 py-1.5 shadow-[0_8px_26px_rgba(20,21,20,0.08)]">
              <span className="h-1.5 w-1.5 rounded-full bg-(--blue) animate-pulse-dot" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-(--blue)">
                Now in Early Access
              </span>
            </div>

            <h1 className="animate-hero-in stagger-2 text-[clamp(3rem,8vw,6.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-(--ink)">
              Code together.
              <br />
              Build{' '}
              <span className="relative inline-block">
                <span className="absolute -inset-x-2 inset-y-1 -rotate-2 bg-(--acid)" aria-hidden="true" />
                <span className="relative text-[#10140b]">faster.</span>
              </span>
              <br />
              Think smarter with{' '}
              <span className="syn-outline-word">AI.</span>
            </h1>

            <p className={`animate-hero-in stagger-3 mb-9 mt-7 max-w-2xl text-base leading-8 md:text-lg ${t.textSecondary}`}>
              A browser-based collaborative IDE with real-time editing, multi-language execution,
              and an AI assistant that actually understands your code.
            </p>

            <div className="animate-hero-in stagger-4 flex w-full max-w-lg flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to={isAuthenticated ? '/editor' : '/login'}
                className={`${t.btnAccent} group w-full px-7 py-3.5 text-[15px] sm:w-auto`}
              >
                <Terminal size={16} />
                Open the Editor
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                to={isAuthenticated ? '/dashboard' : '/signup'}
                className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-(--ink) underline decoration-(--red) decoration-2 underline-offset-[6px] transition-colors hover:text-(--red)"
              >
                <Zap size={15} />
                {isAuthenticated ? 'Open Dashboard' : 'Start Free'}
              </Link>
            </div>

            <p className={`animate-fade-up mt-7 font-mono text-[11px] uppercase tracking-[0.12em] ${t.textMuted2}`}>
              {!isAuthenticated
                ? 'No credit card required · No local setup · 12+ languages supported'
                : 'Workspace ready — launch your editor or start a room with your team'}
            </p>

            <Reveal className="mt-14 grid w-full max-w-5xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
              {trustStats.map((stat) => (
                <div key={stat.label} className={`${t.card} ${t.cardHover} p-5 transition-colors`}>
                  <p className="font-mono text-3xl font-bold tracking-tight text-(--ink)">
                    {stat.countTo != null ? (
                      <>{stat.prefix}<AnimatedCounter to={stat.countTo} suffix={stat.suffix} /></>
                    ) : (
                      stat.value
                    )}
                  </p>
                  <p className={`${t.eyebrow} mt-2`}>
                    {stat.label}
                  </p>
                  <p className={`mt-2 text-[13px] leading-6 ${t.textMuted2}`}>{stat.detail}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        { }
        <section className="relative -rotate-1 py-6" aria-label="Technology stack">
          <div className="overflow-hidden border-y-2 border-(--ink) bg-(--blue) py-3.5">
            <div className="animate-marquee flex w-max items-center gap-10 font-mono text-sm font-bold uppercase tracking-[0.12em] text-white">
              {[...techStack, ...techStack].map((tech, i) => (
                <span key={i} className="flex items-center gap-10">
                  <span>✦</span>
                  <span>{tech}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        { }
        <section id="preview" className="px-5 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className={`${t.eyebrow} text-(--blue)`}>Live preview</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-(--ink) sm:text-4xl">
                One link. Zero setup. Total flow.
              </h2>
              <p className={`mx-auto mt-4 max-w-2xl text-base leading-8 ${t.textSecondary}`}>
                This is what your team sees the second they join — cursors, code, and execution,
                all in sync.
              </p>
            </div>

            <div className="rounded-[14px] border border-[#283348] bg-[#121824] shadow-[0_18px_54px_rgba(20,21,20,0.28)] overflow-hidden">
              { }
              <div className="flex items-center justify-between border-b border-[#283348] bg-[#182131] px-5 py-3.5">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#3a4356]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#3a4356]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#3a4356]" />
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-[#8290a8]">
                    <Terminal size={13} />
                    src/main.py
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1.5">
                    {['S', 'V', 'R'].map((label) => (
                      <div
                        key={label}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#182131] bg-[#3a4356] text-[10px] font-bold text-[#dce5f3]"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-[#d9ff3f] px-2 py-1 font-mono text-[10px] font-bold text-[#10140b]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10140b] animate-pulse-dot" />
                    LIVE
                  </span>
                </div>
              </div>

              { }
              <div className="p-6 font-mono text-[13px] leading-7 text-[#dce5f3] sm:p-8">
                <div className="flex gap-6">
                  <div className="select-none text-right text-[#3a4356]">
                    1<br />2<br />3<br />4<br />5<br />6
                  </div>

                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="text-[#70a5ff]">from</span>{' '}
                      <span className="text-[#dce5f3]">synapse</span>{' '}
                      <span className="text-[#70a5ff]">import</span>{' '}
                      <span className="text-[#d5ee76]">Room</span>
                    </p>
                    <p>&nbsp;</p>
                    <p>
                      <span className="text-[#8290a8]"># one link — the whole team is in</span>
                    </p>
                    <p>
                      room = Room.<span className="text-[#d5ee76]">connect</span>(
                      <span className="text-[#ff997c]">&quot;synapse.dev/r/8X2KQ&quot;</span>)
                    </p>
                    <p className="flex items-center gap-2">
                      <span>
                        room.<span className="text-[#d5ee76]">start_sync</span>()
                      </span>
                      <span className="rounded bg-[#283348] px-1.5 py-0.5 text-[10px] font-bold text-[#70a5ff]">
                        Sarah
                      </span>
                      <span className="inline-block h-4 w-0.5 bg-[#ff684d] animate-blink" />
                    </p>
                    <p>
                      <span className="text-[#70a5ff]">print</span>(
                      <span className="text-[#ff997c]">&quot;shipped together&quot;</span>)
                    </p>
                  </div>
                </div>
              </div>

              { }
              <div className="flex items-center justify-between border-t border-[#283348] bg-[#182131] px-5 py-3 font-mono text-[11px] text-[#8290a8]">
                <div className="flex items-center gap-5">
                  <span className="flex items-center gap-1.5">
                    <Activity size={13} /> 12ms latency
                  </span>
                  <span>3 collaborators online</span>
                </div>
                <span>v2.4.1-stable</span>
              </div>
            </div>
          </Reveal>
        </section>

        { }
        <section id="features" className="px-5 pb-20 sm:px-6 lg:px-8">
          <div id="workflow" className="mx-auto max-w-6xl">
            <Reveal>
              <div className="mb-10 max-w-2xl">
                <p className={`${t.eyebrow} text-(--blue)`}>How it works</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-(--ink) sm:text-4xl">
                  A faster path from idea to shared output.
                </h2>
                <p className={`mt-4 text-base leading-8 ${t.textSecondary}`}>
                  Setup, collaboration, execution, and AI support in one streamlined flow.
                </p>
              </div>

              <div className={`border-t ${t.divider}`}>
                {collaborationHighlights.map((highlight, i) => (
                  <article
                    key={highlight.title}
                    className={`grid items-start gap-4 border-b py-8 sm:grid-cols-[64px_52px_1fr] sm:gap-6 ${t.divider}`}
                  >
                    <span className="font-mono text-sm font-bold text-(--red)">
                      0{i + 1}
                    </span>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg border bg-(--panel) shadow-[4px_4px_0_var(--ink)] ${t.border}`}>
                      <highlight.icon size={20} className="text-(--ink)" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold tracking-tight text-(--ink)">{highlight.title}</h3>
                      <p className={`mt-2 max-w-xl text-[15px] leading-7 ${t.textSecondary}`}>{highlight.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        { }
        <section id="use-cases" className="px-5 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="mb-10 max-w-2xl">
                <p className={`${t.eyebrow} text-(--blue)`}>Who it&apos;s for</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-(--ink) sm:text-4xl">
                  Built for real collaboration, not just solo editing.
                </h2>
                <p className={`mt-4 text-base leading-8 ${t.textSecondary}`}>
                  Built for pair programming, interviews, and classrooms.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {useCases.map((useCase) => (
                  <article
                    key={useCase.title}
                    className={`${t.card} ${t.cardHover} p-6 transition-colors`}
                  >
                    <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg border bg-(--panel) ${t.border}`}>
                      <useCase.icon size={20} className="text-(--ink)" />
                    </div>
                    <h3 className="text-[17px] font-extrabold tracking-tight text-(--ink)">{useCase.title}</h3>
                    <p className={`mt-2 text-sm leading-7 ${t.textSecondary}`}>{useCase.description}</p>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        { }
        <section className="px-5 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="mb-10 max-w-2xl">
                <p className={`${t.eyebrow} text-(--blue)`}>What teams say</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-(--ink) sm:text-4xl">
                  Loved by teams building together.
                </h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {testimonials.map((testimonial) => (
                  <figure
                    key={testimonial.name}
                    className={`${t.card} flex flex-col p-6`}
                  >
                    <Quote size={20} className="mb-4 text-(--red)" aria-hidden="true" />
                    <blockquote className={`flex-1 text-[15px] leading-8 font-medium ${t.textPrimary}`}>
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                    <div className="mb-5 mt-4 flex gap-1" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} size={13} className="fill-[#ff4d35] text-[#ff4d35]" />
                      ))}
                    </div>
                    <figcaption className={`flex items-center gap-3 border-t ${t.divider} pt-5`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--ink) text-xs font-bold text-(--paper)">
                        {testimonial.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                      <span>
                        <span className={`block text-sm font-extrabold ${t.textPrimary}`}>{testimonial.name}</span>
                        <span className={`mt-0.5 block font-mono text-[11px] ${t.textMuted2}`}>
                          {testimonial.role}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        { }
        <section id="faq" className="px-5 pb-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className={`${t.eyebrow} text-(--blue)`}>FAQ</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-(--ink)">
                Quick answers before you start.
              </h2>
              <p className={`mt-4 text-base leading-8 ${t.textSecondary}`}>
                Everything teams usually ask before creating a room.
              </p>
              <Link
                to={isAuthenticated ? '/dashboard' : '/signup'}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold text-(--red) underline decoration-2 underline-offset-4 hover:opacity-80"
              >
                Still curious? Just dive in
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className={`border-t ${t.divider}`}>
              {faqItems.map((item) => (
                <article key={item.question} className={`border-b py-5 ${t.divider}`}>
                  <h3 className={`text-[15px] font-extrabold ${t.textPrimary}`}>
                    {item.question}
                  </h3>
                  <p className={`mt-1.5 text-sm leading-7 ${t.textSecondary}`}>{item.answer}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        { }
        <section className="px-5 pb-24 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-6xl">
            <div className={`rounded-[14px] border px-6 py-14 text-center sm:px-12 shadow-[12px_14px_0_var(--blue)] ${
              theme === 'dark'
                ? 'border-[#b9c8ee] bg-[#dbe6ff]'
                : 'border-[#0d1526] bg-[#17213a]'
            }`}>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-(--red) mb-4">
                Ready to collaborate
              </p>
              <h2 className={`mx-auto mb-4 max-w-2xl text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl ${
                theme === 'dark' ? 'text-[#141514]' : 'text-white'
              }`}>
                Build faster with your team in Synapse.
              </h2>
              <p className={`mx-auto mb-8 max-w-xl text-base leading-8 ${
                theme === 'dark' ? 'text-[#3d4a6b]' : 'text-[#a9b6d6]'
              }`}>
                Create rooms, code together in real time, run your programs, and use AI assistance
                without leaving your browser.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/signup'}
                  className={`${t.btnAccent} group px-7 py-3.5 text-[15px]`}
                >
                  {isAuthenticated ? 'Open Dashboard' : 'Create Account'}
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link
                  to={isAuthenticated ? '/editor' : '/login'}
                  className={`inline-flex items-center gap-2 px-6 py-3.5 text-[15px] font-extrabold underline decoration-2 underline-offset-[6px] ${
                    theme === 'dark' ? 'text-[#141514] decoration-[#141514]' : 'text-white decoration-white/60'
                  }`}
                >
                  <Play size={14} />
                  {isAuthenticated ? 'Open Editor' : 'Launch Editor'}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      { }
      <footer
        id="footer"
        className={`border-t px-5 py-12 sm:px-6 lg:px-8 ${t.divider}`}
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--red)">
                <SynapseLogo size={18} color="#ffffff" nodeColor="#ffffff" />
              </span>
              <span className="text-[17px] font-extrabold tracking-tight text-(--ink)">
                Synapse
              </span>
            </div>
            <p className={`mt-4 text-sm leading-7 ${t.textSecondary}`}>
              A collaborative IDE for teams that want shared editing, code execution, and AI support
              in one browser-native workflow.
            </p>
            <div className="mt-5 inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-(--blue) animate-pulse-dot" />
              <span className={`font-mono text-[11px] uppercase tracking-widest ${t.textMuted2}`}>All systems operational</span>
            </div>
            <p className={`mt-5 font-mono text-[11px] ${t.textMuted2}`}>
              {'\u00A9'} 2026 Synapse Technologies
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className={t.eyebrow}>
                  {group.title}
                </h3>
                <div className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className={`block text-sm font-semibold transition-colors duration-150 ${t.textSecondary} hover:text-(--ink)`}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
