import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { requestLoginOtp } from '../services/authService';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Zap,
  Users,
  Sparkles,
  LogIn,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import { readStorage } from '../utils/storage';
import SynapseLogo from '../components/SynapseLogo';

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: 'Instant code execution',
    desc: 'Run Python, JavaScript, C++ and Java in one click.',
  },
  {
    icon: Users,
    title: 'Live multi-cursor collaboration',
    desc: 'See teammates type in real time with CRDT sync.',
  },
  {
    icon: Sparkles,
    title: 'Neura AI pair programmer',
    desc: 'Explain, debug and refactor without leaving the editor.',
  },
];

function BrandPanel({ t }) {
  return (
    <aside className={`hidden lg:flex w-[44%] flex-col justify-between p-12 border-r ${t.border} bg-(--paper-2) relative overflow-hidden`}>
      <div className="syn-paper-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative">
        <Link to="/" className="flex items-center gap-2.5 w-fit">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--red)">
            <SynapseLogo size={20} color="#ffffff" nodeColor="#ffffff" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-(--ink)">
            Synapse
          </span>
        </Link>
      </div>

      <div className="relative">
        <p className={`${t.eyebrow} mb-4 text-(--blue)`}>Realtime collaborative IDE</p>
        <h1 className="text-5xl font-extrabold tracking-[-0.04em] text-(--ink) leading-[1.02] mb-5">
          Code together,
          <br />
          in{' '}
          <span className="relative inline-block">
            <span className="absolute -inset-x-2 inset-y-1 -rotate-2 bg-(--acid)" aria-hidden="true" />
            <span className="relative text-[#10140b]">real time.</span>
          </span>
        </h1>
        <p className={`text-[15px] leading-8 max-w-md mb-9 ${t.textSecondary}`}>
          The multiplayer code editor with instant execution and an AI pair
          programmer built in.
        </p>

        <div className="space-y-4">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className={`flex items-start gap-3.5 rounded-lg border bg-(--panel) p-3.5 shadow-[4px_4px_0_var(--ink)] ${t.border}`}>
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 bg-(--paper-2) ${t.border}`}>
                <item.icon size={16} className="text-(--ink)" />
              </div>
              <div>
                <p className={`font-extrabold text-sm ${t.textPrimary}`}>{item.title}</p>
                <p className={`text-[13px] mt-0.5 ${t.textMuted2}`}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl border border-[#283348] bg-[#121824] p-5 max-w-sm shadow-[0_18px_54px_rgba(20,21,20,0.25)]">
        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3a4356]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3a4356]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3a4356]" />
          <span className="ml-2 font-mono text-[11px] text-[#8290a8]">main.py — 3 online</span>
        </div>
        <div className="font-mono text-xs leading-6 text-[#dce5f3]">
          <p><span className="text-[#70a5ff]">def</span> <span className="text-[#d5ee76]">greet</span><span className="text-[#dce5f3]">():</span></p>
          <p className="pl-4">
            <span className="text-[#70a5ff]">print</span><span className="text-[#dce5f3]">(</span><span className="text-[#ff997c]">"Hello, Synapse!"</span><span className="text-[#dce5f3]">)</span>
          </p>
          <p className="pl-4"><span className="text-[#8290a8]"># Priya is typing…</span><span className="inline-block h-3.5 w-0.5 bg-[#ff684d] animate-blink ml-1 align-middle" /></p>
        </div>
      </div>
    </aside>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs font-semibold text-(--red) mt-1.5 animate-fade-in">{message}</p>;
}

export default function Login() {
  const { completeLogin } = useAuth();
  const [theme] = useState(() => readStorage('synapse-theme') || 'dark');
  const t = getThemeClasses(theme);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#111310' : '#f3f1eb';
    return () => { document.body.style.backgroundColor = ''; };
  }, [theme]);

  function validateCredentials() {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateOtp() {
    const newErrors = {};

    if (!otp.trim()) {
      newErrors.otp = 'OTP is required';
    } else if (!/^\d{6}$/.test(otp.trim())) {
      newErrors.otp = 'OTP must be 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    setServerError('');
    setStatusMessage('');

    if (!validateCredentials()) return;

    setIsLoading(true);
    try {
      const data = await requestLoginOtp(formData.email, formData.password);
      setOtpStep(true);
      setOtp('');
      setStatusMessage(data.message || `OTP sent to ${data.email}`);
    } catch (err) {
      setServerError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setServerError('');
    setStatusMessage('');

    if (!validateOtp()) return;

    setIsLoading(true);
    try {
      await completeLogin(formData.email, otp.trim());
    } catch (err) {
      setServerError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    setServerError('');
    setStatusMessage('');
    setIsLoading(true);
    try {
      const data = await requestLoginOtp(formData.email, formData.password);
      setStatusMessage(data.message || `OTP resent to ${data.email}`);
    } catch (err) {
      setServerError(err.message || 'Unable to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange(field) {
    return (e) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
      if (serverError) setServerError('');
      if (statusMessage) setStatusMessage('');
    };
  }

  return (
    <div className={`${t.page} syn-grain min-h-screen`} data-theme={theme}>
      <div className="flex min-h-screen">
        <BrandPanel t={t} />

        { }
        <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md animate-fade-up">
            <Link to="/" className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--red) shadow-[3px_3px_0_var(--ink)]">
                <SynapseLogo size={20} color="#ffffff" nodeColor="#ffffff" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-(--ink)">Synapse</span>
            </Link>

            <div className={`${t.card} p-8 relative overflow-hidden`}>
              { }
              <div className="absolute top-0 left-0 right-0 h-1 bg-(--red)" aria-hidden="true" />

              <div className="mb-7">
                <div className={`w-11 h-11 rounded-lg border bg-(--panel) flex items-center justify-center mb-4 shadow-[4px_4px_0_var(--ink)] ${t.border}`}>
                  {otpStep ? <KeyRound size={18} className="text-(--ink)" /> : <LogIn size={18} className="text-(--ink)" />}
                </div>
                <p className={`${t.eyebrow} mb-2 text-(--blue)`}>
                  {otpStep ? 'Step 02 — Verify' : 'Step 01 — Sign in'}
                </p>
                <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-(--ink) mb-1.5">
                  {otpStep ? 'Enter your OTP' : 'Welcome back'}
                </h1>
                <p className={`text-sm leading-relaxed ${t.textSecondary}`}>
                  {otpStep
                    ? <>Enter the 6-digit code sent to <span className={`font-bold ${t.textPrimary}`}>{formData.email}</span></>
                    : 'Sign in to continue to your workspace'}
                </p>
              </div>

              {statusMessage && (
                <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-(--blue)/7 border border-(--blue)/30 text-(--blue) text-[13px] font-semibold mb-5 animate-fade-in">
                  <Mail size={15} className="shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {serverError && (
                <div key={serverError} className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-(--red)/7 border border-(--red)/30 text-(--red) text-[13px] font-semibold mb-5 animate-fade-in">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={otpStep ? handleVerifyOtp : handleRequestOtp} className="flex flex-col gap-4" noValidate>
                {!otpStep ? (
                  <>
                    <div>
                      <label htmlFor="login-email" className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
                        Email address
                      </label>
                      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${errors.email ? 'border-(--red)' : ''}`}>
                        <Mail size={16} className={`shrink-0 ${t.textMuted2}`} />
                        <input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange('email')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-(--ink) placeholder:text-(--muted) placeholder:font-normal"
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.email} />
                    </div>

                    <div>
                      <label htmlFor="login-password" className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
                        Password
                      </label>
                      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${errors.password ? 'border-(--red)' : ''}`}>
                        <Lock size={16} className={`shrink-0 ${t.textMuted2}`} />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={handleChange('password')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-(--ink) placeholder:text-(--muted) placeholder:font-normal"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`${t.textMuted2} hover:text-(--ink) transition-colors p-1 -m-1`}
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <FieldError message={errors.password} />
                    </div>

                    <button type="submit" className={`${t.btnAccent} group w-full h-12 mt-1 text-[15px]`} disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Sending OTP...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Continue with OTP
                          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="login-otp" className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
                        Email OTP
                      </label>
                      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${errors.otp ? 'border-(--red)' : ''}`}>
                        <KeyRound size={16} className={`shrink-0 ${t.textMuted2}`} />
                        <input
                          id="login-otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, ''));
                            if (errors.otp) {
                              setErrors((prev) => ({ ...prev, otp: '' }));
                            }
                            if (serverError) setServerError('');
                            if (statusMessage) setStatusMessage('');
                          }}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-(--ink) placeholder:text-(--muted) placeholder:font-normal font-mono tracking-[0.3em]"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.otp} />
                      <p className={`font-mono text-[11px] mt-2 ${t.textMuted2}`}>
                        Your password is checked first, then the OTP completes login.
                      </p>
                    </div>

                    <button type="submit" className={`${t.btnAccent} group w-full h-12 mt-1 text-[15px]`} disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Verifying OTP...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Verify and Sign In
                          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      )}
                    </button>

                    <div className="flex items-center justify-between">
                      <button type="button" onClick={handleResendOtp} disabled={isLoading} className="text-[13px] font-bold text-(--red) disabled:opacity-50 transition-opacity hover:underline">
                        Resend OTP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep(false);
                          setOtp('');
                          setErrors({});
                          setServerError('');
                          setStatusMessage('');
                        }}
                        disabled={isLoading}
                        className="text-[13px] font-bold text-(--red) disabled:opacity-50 transition-opacity hover:underline"
                      >
                        Change login details
                      </button>
                    </div>
                  </>
                )}
              </form>

              <div className={`text-center mt-6 pt-5 border-t ${t.divider} text-[13px] ${t.textMuted2}`}>
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="text-(--red) font-extrabold hover:underline">
                  Create one
                </Link>
              </div>
            </div>

            <p className={`text-center font-mono text-[11px] mt-5 ${t.textMuted2}`}>
              {otpStep ? 'JWT session starts only after OTP verification succeeds.' : 'Secure login powered by password + email OTP'}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
