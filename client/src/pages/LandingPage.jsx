import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Cpu,
  GitBranch,
  LayoutDashboard,
  Layers,
  Play,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Users2,
  UserRound,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { getAvatarStyle, getUserInitial } from '../utils/avatar';
import SynapseLogo from '../components/SynapseLogo';

class BackgroundParticle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 1;
    this.color = Math.random() > 0.5 ? '#6366f1' : '#a855f7';
    this.pulse = Math.random() * Math.PI;
  }

  update(mouseRef) {
    this.x += this.vx;
    this.y += this.vy;
    this.pulse += 0.01;

    if (mouseRef.current.active) {
      const dx = mouseRef.current.x - this.x;
      const dy = mouseRef.current.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 300) {
        const force = (300 - distance) / 3000;
        this.vx += dx * force * 0.05;
        this.vy += dy * force * 0.05;
      }
    }

    this.vx *= 0.98;
    this.vy *= 0.98;

    if (this.x < 0) this.x = this.canvas.width;
    if (this.x > this.canvas.width) this.x = 0;
    if (this.y < 0) this.y = this.canvas.height;
    if (this.y > this.canvas.height) this.y = 0;
  }

  draw(context) {
    const opacity = 0.4 + Math.sin(this.pulse) * 0.2;

    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fillStyle = this.color;
    context.globalAlpha = opacity;
    context.shadowBlur = 10;
    context.shadowColor = this.color;
    context.fill();
    context.globalAlpha = 1;
  }
}

function MedusaeBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    let animationFrameId;
    let particles = [];
    const particleCount = 80;
    const connectionDistance = 200;
    let disposed = false;

    const initializeCanvas = () => {
      if (disposed) {
        return;
      }

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: particleCount }, () => new BackgroundParticle(canvas));
    };

    const drawConnections = () => {
      context.shadowBlur = 0;

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const particleA = particles[i];
          const particleB = particles[j];
          const dx = particleA.x - particleB.x;
          const dy = particleA.y - particleB.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.3;
            let mouseBonus = 0;

            if (mouseRef.current.active) {
              const midX = (particleA.x + particleB.x) / 2;
              const midY = (particleA.y + particleB.y) / 2;
              const mouseDx = midX - mouseRef.current.x;
              const mouseDy = midY - mouseRef.current.y;
              const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

              if (mouseDistance < 250) {
                mouseBonus = (1 - mouseDistance / 250) * 0.3;
              }
            }

            context.beginPath();
            context.moveTo(particleA.x, particleA.y);

            const midX = (particleA.x + particleB.x) / 2;
            const midY = (particleA.y + particleB.y) / 2;

            context.quadraticCurveTo(midX + 10, midY + 10, particleB.x, particleB.y);
            context.strokeStyle = particleA.color;
            context.lineWidth = (1 - distance / connectionDistance) * 1.2 + mouseBonus;
            context.globalAlpha = opacity + mouseBonus;
            context.stroke();
            context.globalAlpha = 1;
          }
        }
      }
    };

    const animate = () => {
      if (disposed) {
        return;
      }

      context.fillStyle = '#050508';
      context.globalAlpha = 0.15;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 1;

      particles.forEach((particle) => {
        particle.update(mouseRef);
        particle.draw(context);
      });

      drawConnections();
      animationFrameId = window.requestAnimationFrame(animate);
    };

    const handleMouseMove = (event) => {
      // The canvas is fixed to the viewport, so pointer tracking must stay in viewport coordinates too.
      mouseRef.current = { x: event.clientX, y: event.clientY, active: true };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleResize = () => {
      initializeCanvas();
    };

    initializeCanvas();
    animate();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 bg-void">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),transparent_38%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.08),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,#050508_88%)]" />
    </div>
  );
}

function NavItem({ href, children }) {
  return (
    <a
      href={href}
      className="group relative py-1.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:text-white"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full bg-linear-to-r from-violet-500 to-cyan-400 transition-all duration-300 group-hover:w-full" />
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
  { value: '<20ms', label: 'collaboration sync', detail: 'Fast room presence and shared edits.' },
  { value: '12+', label: 'languages ready', detail: 'Run code across common interview and project stacks.' },
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
      { label: 'Status', href: '#status' },
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
  const { isAuthenticated, user, logout } = useAuth();
  const displayName = getDisplayName(user);
  const initials = getUserInitial(user);
  const userAvatarStyle = getAvatarStyle(user);

  useEffect(() => {
    document.body.style.backgroundColor = '#050508';

    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="syn-noise min-h-screen overflow-x-hidden bg-void font-sans text-slate-200 selection:bg-violet-500/30 selection:text-violet-100">
      <MedusaeBackground />

      {/* Aurora orbs above the canvas */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="animate-aurora absolute -left-32 -top-32 h-136 w-136 rounded-full bg-violet-600/13 blur-[140px]" />
        <div className="animate-aurora absolute -right-32 top-[30%] h-120 w-120 rounded-full bg-indigo-600/10 blur-[140px]" style={{ animationDelay: '-8s' }} />
        <div className="animate-aurora absolute -bottom-40 left-[30%] h-112 w-md rounded-full bg-cyan-500/[0.07] blur-[140px]" style={{ animationDelay: '-16s' }} />
      </div>

      <header
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-500 ${isScrolled
          ? 'border-b border-white/[0.07] bg-void/75 py-3.5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent py-5'
          }`}
      >
        <div className="mx-auto grid w-full max-w-368 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-8">
          <Link to="/" className="group flex shrink-0 items-center gap-3 justify-self-start" aria-label="Synapse home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 via-indigo-600 to-indigo-500 shadow-[0_0_28px_rgba(139,92,246,0.45)] ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <SynapseLogo size={22} color="#ffffff" nodeColor="#ffffff" className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold uppercase tracking-tight text-white">
              Synapse
            </span>
          </Link>

          <nav className="hidden items-center justify-center gap-9 lg:flex">
            <NavItem href="#features">Features</NavItem>
            <NavItem href="#workflow">How It Works</NavItem>
            <NavItem href="#preview">Preview</NavItem>
            <NavItem href="#faq">FAQ</NavItem>
          </nav>

          <div className="flex items-center justify-self-end gap-2 sm:gap-3">
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/9"
                aria-label="Open dashboard"
                title="Dashboard"
              >
                <LayoutDashboard className="h-4 w-4 text-violet-300" />
                <span>Dashboard</span>
              </Link>
            )}

            {isAuthenticated ? (
              <div className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white backdrop-blur">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                  style={userAvatarStyle}
                >
                  {initials}
                </span>
                <span className="hidden text-left sm:flex sm:flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Signed In
                  </span>
                  <span className="max-w-44 truncate text-sm text-white">{displayName}</span>
                </span>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/9"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/30 bg-linear-to-br from-violet-600/30 to-indigo-600/20 text-violet-200">
                  <UserRound className="h-4 w-4" />
                </span>
                <span className="hidden text-left sm:flex sm:flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Account
                  </span>
                  <span className="text-sm text-white">Log in</span>
                </span>
              </Link>
            )}

            {isAuthenticated && (
              <button
                onClick={logout}
                className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-white/6 hover:text-white xl:inline-flex"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="px-5 pb-20 pt-36 sm:px-6 sm:pb-24 sm:pt-44 lg:px-8">
          <div className="mx-auto flex max-w-368 flex-col items-center text-center">
            <div className="animate-fade-up mb-8 inline-flex items-center gap-2.5 rounded-full border border-violet-400/25 bg-violet-500/8 py-2 pl-4 pr-5 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200 shadow-[0_0_36px_-8px_rgba(139,92,246,0.5)] backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
              </span>
              Now in Early Access
            </div>

            <h1
              className="animate-fade-up font-display mb-7 max-w-6xl text-[2.9rem] font-bold leading-[1.04] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.4rem]"
              style={{ animationDelay: '90ms' }}
            >
              Code together.
              <br />
              <span className="syn-text-gradient-animated">Build faster.</span>
              <br />
              Think smarter with AI.
            </h1>

            <p
              className="animate-fade-up mb-10 max-w-2xl text-base leading-8 text-slate-400 md:text-lg"
              style={{ animationDelay: '180ms' }}
            >
              A browser-based collaborative IDE with real-time editing, multi-language execution,
              and an AI assistant that actually understands your code.
            </p>

            <div
              className="animate-fade-up flex w-full max-w-xl flex-col items-center justify-center gap-4 sm:flex-row"
              style={{ animationDelay: '260ms' }}
            >
              <Link
                to={isAuthenticated ? '/editor' : '/login'}
                className="syn-btn-primary group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-base font-semibold text-white sm:w-auto sm:min-w-[16rem]"
              >
                <Terminal size={19} />
                Open the Editor
                <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                to={isAuthenticated ? '/dashboard' : '/signup'}
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/12 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/9 active:translate-y-0 active:scale-[0.98] sm:w-auto sm:min-w-[16rem]"
              >
                <Zap size={18} className="text-cyan-300 transition-transform duration-200 group-hover:scale-110" />
                {isAuthenticated ? 'Open Dashboard' : 'Start Free'}
              </Link>
            </div>

            {!isAuthenticated ? (
              <p className="animate-fade-up mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500" style={{ animationDelay: '340ms' }}>
                <span className="inline-flex items-center gap-1.5"><Play size={11} className="text-emerald-400" /> No credit card required</span>
                <span className="inline-flex items-center gap-1.5"><Play size={11} className="text-emerald-400" /> No local setup</span>
                <span className="inline-flex items-center gap-1.5"><Play size={11} className="text-emerald-400" /> All languages supported</span>
              </p>
            ) : (
              <p className="animate-fade-up mt-7 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500" style={{ animationDelay: '340ms' }}>
                Workspace ready · Launch your editor · Start a room with your team
              </p>
            )}

            <div className="mt-14 grid w-full max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {trustStats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="animate-fade-up syn-card-hover rounded-2xl border border-white/[0.07] bg-white/3 px-6 py-5 text-left backdrop-blur-xl"
                  style={{ animationDelay: `${420 + i * 80}ms` }}
                >
                  <p className="font-display text-[1.65rem] font-bold tracking-tight text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">
                    {stat.label}
                  </p>
                  <p className="mt-2.5 text-sm leading-6 text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TECH MARQUEE ─────────────────────────────────── */}
        <section className="relative border-y border-white/6 bg-white/1.5 py-7 backdrop-blur-sm" aria-label="Technology stack">
          <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-slate-600">
            Powered by battle-tested technology
          </p>
          <div className="overflow-hidden mask-[linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="animate-marquee flex w-max items-center gap-4 pr-4">
              {[...techStack, ...techStack].map((tech, i) => (
                <span
                  key={`${tech}-${i}`}
                  aria-hidden={i >= techStack.length}
                  className="inline-flex shrink-0 items-center gap-2.5 rounded-full border border-white/8 bg-white/3 px-5 py-2.5 text-sm font-semibold text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-linear-to-r from-violet-400 to-cyan-400" />
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── LIVE PREVIEW ─────────────────────────────────── */}
        <section id="preview" className="px-5 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-368">
            <div className="animate-fade-up mb-10 text-center">
              <p className="syn-eyebrow justify-center">Live preview</p>
              <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                One link. <span className="syn-text-gradient">Zero setup.</span> Total flow.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-400">
                This is what your team sees the second they join — cursors, code, and execution,
                all in sync.
              </p>
            </div>

            <div className="animate-fade-up relative" style={{ animationDelay: '120ms' }}>
              <div className="absolute left-1/2 top-8 h-24 w-xl max-w-full -translate-x-1/2 rounded-full bg-violet-600/20 blur-[110px]" aria-hidden="true" />
              <div className="syn-glass relative overflow-hidden rounded-3xl shadow-[0_40px_120px_-32px_rgba(0,0,0,0.9)] transition-shadow duration-500 hover:shadow-[0_40px_120px_-24px_rgba(139,92,246,0.35)]">
                {/* window chrome */}
                <div className="flex flex-col gap-4 border-b border-white/[0.07] bg-white/2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <div className="flex items-center gap-5">
                    <div className="flex gap-2">
                      <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                      <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                      <div className="h-3 w-3 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="hidden h-5 w-px bg-white/10 sm:block" />
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                      <Terminal size={13} className="text-violet-400" />
                      src/main.py
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="flex -space-x-2.5">
                      {[
                        { label: 'S', bg: 'from-violet-500 to-indigo-600' },
                        { label: 'V', bg: 'from-cyan-500 to-blue-600' },
                        { label: 'R', bg: 'from-fuchsia-500 to-purple-600' },
                      ].map((peer) => (
                        <div
                          key={peer.label}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-panel bg-linear-to-br ${peer.bg} text-[10px] font-bold text-white shadow-lg`}
                        >
                          {peer.label}
                        </div>
                      ))}
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      Live
                    </div>
                  </div>
                </div>

                {/* code */}
                <div className="relative p-6 font-mono text-sm leading-8 text-slate-300 sm:p-10 sm:text-[15px]">
                  <div className="flex gap-6 sm:gap-8">
                    <div className="select-none text-right leading-8 text-slate-700">
                      1<br />2<br />3<br />4<br />5<br />6
                    </div>

                    <div className="min-w-0 flex-1">
                      <p>
                        <span className="text-fuchsia-400">from</span>{' '}
                        <span className="text-slate-200">synapse</span>{' '}
                        <span className="text-fuchsia-400">import</span>{' '}
                        <span className="text-cyan-300">Room</span>
                      </p>
                      <p>&nbsp;</p>
                      <p>
                        <span className="text-slate-500"># one link — the whole team is in</span>
                      </p>
                      <p>
                        room = Room.<span className="text-indigo-300">connect</span>(
                        <span className="text-emerald-300">&quot;synapse.dev/r/8X2KQ&quot;</span>)
                      </p>
                      <div className="relative flex items-center gap-2">
                        <p className="min-w-0">
                          room.<span className="text-indigo-300">start_sync</span>()
                        </p>
                        <span className="animate-blink h-5 w-0.5 rounded bg-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.9)]" />
                        <span className="rounded-md bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_4px_16px_rgba(139,92,246,0.5)]">
                          Sarah
                        </span>
                        <span
                          className="animate-float absolute -top-7 left-[46%] hidden rounded-md bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_4px_16px_rgba(34,211,238,0.5)] sm:block"
                        >
                          You
                        </span>
                      </div>
                      <p>
                        <span className="text-fuchsia-400">print</span>(
                        <span className="text-emerald-300">&quot;shipped together&quot;</span>)
                      </p>
                    </div>
                  </div>
                </div>

                {/* status bar */}
                <div
                  id="status"
                  className="flex flex-col gap-2 border-t border-white/[0.07] bg-violet-500/4 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-8">
                    <span className="flex items-center gap-2 text-violet-300">
                      <Activity size={14} /> 12ms Latency
                    </span>
                    <span>3 collaborators online</span>
                  </div>
                  <span className="font-mono normal-case tracking-normal text-slate-600">v2.4.1-stable</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES / HOW IT WORKS ──────────────────────── */}
        <section id="features" className="px-5 pb-24 sm:px-6 lg:px-8">
          <div id="workflow" className="mx-auto max-w-368">
            <div className="animate-fade-up mb-14 max-w-3xl">
              <p className="syn-eyebrow">How it works</p>
              <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                A faster path from idea <span className="syn-text-gradient">to shared output.</span>
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-400 sm:text-lg">
                Setup, collaboration, execution, and AI support in one streamlined flow.
              </p>
            </div>

            <div className="relative grid gap-5 lg:grid-cols-3">
              <div className="absolute left-0 right-0 top-16 hidden h-px bg-linear-to-r from-transparent via-violet-500/40 to-transparent lg:block" aria-hidden="true" />
              {collaborationHighlights.map((highlight, i) => (
                <article
                  key={highlight.title}
                  className="animate-fade-up syn-card-hover syn-glass group relative overflow-hidden rounded-3xl p-8"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-600/15 blur-3xl transition-opacity duration-500 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                  <div className="relative">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-violet-400/25 bg-linear-to-br from-violet-500/20 to-indigo-500/10 p-3.5 text-violet-300 shadow-[0_0_24px_-6px_rgba(139,92,246,0.5)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                        <highlight.icon size={24} />
                      </div>
                      <span className="font-display text-5xl font-bold text-white/[0.07] transition-colors duration-300 group-hover:text-violet-400/25">
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">{highlight.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{highlight.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── USE CASES ────────────────────────────────────── */}
        <section id="use-cases" className="px-5 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-368">
            <div className="animate-fade-up mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="syn-eyebrow">Who it&apos;s for</p>
                <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  Built for real collaboration, <span className="syn-text-gradient">not just solo editing.</span>
                </h2>
              </div>
              <p className="max-w-md text-base leading-8 text-slate-400">
                Built for pair programming, interviews, and classrooms.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {useCases.map((useCase, i) => (
                <article
                  key={useCase.title}
                  className="animate-fade-up syn-card-hover syn-glass group relative overflow-hidden rounded-3xl p-8"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl transition-opacity duration-500 opacity-50 group-hover:opacity-100" aria-hidden="true" />
                  <div className="relative">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-linear-to-br from-cyan-500/20 to-blue-500/10 text-cyan-300 shadow-[0_0_24px_-6px_rgba(34,211,238,0.5)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                      <useCase.icon size={26} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">{useCase.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{useCase.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300 opacity-0 transition-all duration-300 group-hover:opacity-100">
                      Explore <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────── */}
        <section className="px-5 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-368">
            <div className="animate-fade-up mb-12 max-w-3xl">
              <p className="syn-eyebrow">What teams say</p>
              <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Loved by teams <span className="syn-text-gradient">building together.</span>
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {testimonials.map((testimonial, i) => (
                <figure
                  key={testimonial.name}
                  className="animate-fade-up syn-card-hover syn-glass relative flex flex-col rounded-3xl p-8"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <Quote size={28} className="mb-5 text-violet-400/60" aria-hidden="true" />
                  <blockquote className="flex-1 text-[15px] leading-8 text-slate-300">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <div className="mb-6 mt-5 flex gap-1" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <figcaption className="flex items-center gap-3.5 border-t border-white/[0.07] pt-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]">
                      {testimonial.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-white">{testimonial.name}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {testimonial.role}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section id="faq" className="px-5 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-368 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="animate-fade-up syn-glass relative overflow-hidden rounded-3xl p-8 sm:p-10">
              <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-violet-600/15 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <p className="syn-eyebrow">FAQ</p>
                <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Quick answers <span className="syn-text-gradient">before you start.</span>
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-400">
                  Everything teams usually ask before creating a room.
                </p>
                <Link
                  to={isAuthenticated ? '/dashboard' : '/signup'}
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
                >
                  Still curious? Just dive in
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              {faqItems.map((item, i) => (
                <article
                  key={item.question}
                  className="animate-fade-up syn-glass group rounded-3xl p-6 transition-all duration-300 hover:border-cyan-400/25 hover:bg-cyan-500/4 sm:p-7"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <h3 className="font-display flex items-start gap-3 text-lg font-bold text-white">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-[11px] font-bold text-violet-300">
                      Q
                    </span>
                    {item.question}
                  </h3>
                  <p className="mt-3 pl-9 text-sm leading-7 text-slate-400">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="px-5 pb-28 sm:px-6 lg:px-8">
          <div className="animate-fade-up mx-auto max-w-368">
            <div className="syn-glass relative overflow-hidden rounded-4xl px-6 py-14 text-center sm:px-12 sm:py-20">
              <div className="animate-aurora absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-600/20 blur-[110px]" aria-hidden="true" />
              <div className="animate-aurora absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-[110px]" style={{ animationDelay: '-10s' }} aria-hidden="true" />
              <div className="relative">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">
                  <Sparkles size={14} className="text-violet-300" />
                  Ready to collaborate
                </div>
                <h2 className="font-display mx-auto mb-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  Build faster with your team <span className="syn-text-gradient-animated">in Synapse.</span>
                </h2>
                <p className="mx-auto mb-10 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                  Create rooms, code together in real time, run your programs, and use AI assistance
                  without leaving your browser.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    to={isAuthenticated ? '/dashboard' : '/signup'}
                    className="syn-btn-primary inline-flex min-w-52 items-center justify-center gap-2 rounded-2xl px-7 py-4 text-sm font-semibold text-white"
                  >
                    {isAuthenticated ? 'Open Dashboard' : 'Create Account'}
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    to={isAuthenticated ? '/editor' : '/login'}
                    className="inline-flex min-w-52 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/9 active:translate-y-0 active:scale-[0.98]"
                  >
                    <Play size={15} className="text-cyan-300" />
                    {isAuthenticated ? 'Open Editor' : 'Launch Editor'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer
        id="footer"
        className="relative z-10 border-t border-white/[0.07] bg-void/85 px-5 py-14 backdrop-blur-xl sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid max-w-368 gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 shadow-[0_0_24px_rgba(139,92,246,0.4)] ring-1 ring-white/20">
                <SynapseLogo size={22} color="#ffffff" nodeColor="#ffffff" className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold uppercase tracking-tight text-white">
                Synapse
              </span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              A collaborative IDE for teams that want shared editing, code execution, and AI support
              in one browser-native workflow.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3.5 py-1.5 text-[11px] font-semibold text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              All systems operational
            </div>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-600">
              {'\u00A9'} 2026 Synapse Technologies · Built for the future
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {group.title}
                </h3>
                <div className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-slate-400 transition-all duration-200 hover:translate-x-0.5 hover:text-white"
                    >
                      {link.label}
                      <ArrowRight size={12} className="opacity-0 transition-all duration-200 group-hover:opacity-100" />
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
