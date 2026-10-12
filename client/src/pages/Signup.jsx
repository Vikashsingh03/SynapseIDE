import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { requestSignupOtp } from '../services/authService';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  User,
  KeyRound,
  Zap,
  Users,
  Sparkles,
  UserPlus,
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
          Your multiplayer
          <br />
          code{' '}
          <span className="syn-outline-word">editor.</span>
        </h1>
        <p className={`text-[15px] leading-8 max-w-md mb-9 ${t.textSecondary}`}>
          Create a free account and start coding with your team in seconds —
          no setup, no config.
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
          <span className="ml-2 font-mono text-[11px] text-[#8290a8]">room · 2 peers online</span>
        </div>
        <div className="font-mono text-xs leading-6 text-[#dce5f3]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-[#3a4356] flex items-center justify-center text-[10px] font-bold text-[#dce5f3]">A</span>
            <span className="text-[#8290a8] text-[11px]">Aarav joined the room</span>
            <span className="ml-auto rounded-[5px] bg-[#d9ff3f] px-1.5 py-0.5 text-[9px] font-bold text-[#10140b]">LIVE</span>
          </div>
          <p><span className="text-[#70a5ff]">const</span> <span className="text-[#dce5f3]">synapse</span> <span className="text-[#70a5ff]">=</span> <span className="text-[#ff997c]">"realtime"</span><span className="text-[#dce5f3]">;</span></p>
          <p><span className="text-[#8290a8]">// Neura AI is reviewing…</span></p>
        </div>
      </div>
    </aside>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs font-semibold text-(--red) mt-1.5 animate-fade-in">{message}</p>;
}

function PasswordField({ id, label, placeholder, value, onChange, show, setShow, error, autoComplete, t }) {
  return (
    <div>
      <label htmlFor={id} className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
        {label}
      </label>
      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${error ? 'border-(--red)' : ''}`}>
        <Lock size={16} className={`shrink-0 ${t.textMuted2}`} />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-(--ink) placeholder:text-(--muted) placeholder:font-normal"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className={`${t.textMuted2} hover:text-(--ink) transition-colors p-1 -m-1`}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export default function Signup() {
  const { completeSignup } = useAuth();
  const [theme] = useState(() => readStorage('synapse-theme') || 'dark');
  const t = getThemeClasses(theme);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#111310' : '#f3f1eb';
    return () => { document.body.style.backgroundColor = ''; };
  }, [theme]);

  function validateCredentials() {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Username is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const data = await requestSignupOtp(formData.name, formData.email, formData.password);
      setOtpStep(true);
      setOtp('');
      setStatusMessage(data.message || `OTP sent to ${data.email}`);
    } catch (err) {
      setServerError(err.message || 'Signup failed. Please try again.');
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
      await completeSignup(formData.email, otp.trim());
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
      const data = await requestSignupOtp(formData.name, formData.email, formData.password);
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
      // Clear field error on change
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

        {/* form side */}
        <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md animate-fade-up">
            <Link to="/" className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--red) shadow-[3px_3px_0_var(--ink)]">
                <SynapseLogo size={20} color="#ffffff" nodeColor="#ffffff" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-(--ink)">Synapse</span>
            </Link>

            <div className={`${t.card} p-8 relative overflow-hidden`}>
              {/* brand accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-(--red)" aria-hidden="true" />

              <div className="mb-7">
                <div className={`w-11 h-11 rounded-lg border bg-(--panel) flex items-center justify-center mb-4 shadow-[4px_4px_0_var(--ink)] ${t.border}`}>
                  {otpStep ? <KeyRound size={18} className="text-(--ink)" /> : <UserPlus size={18} className="text-(--ink)" />}
                </div>
                <p className={`${t.eyebrow} mb-2 text-(--blue)`}>
                  {otpStep ? 'Step 02 — Verify' : 'Step 01 — Create'}
                </p>
                <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-(--ink) mb-1.5">
                  {otpStep ? 'Verify your email' : 'Create your account'}
                </h1>
                <p className={`text-sm leading-relaxed ${t.textSecondary}`}>
                  {otpStep
                    ? <>Enter the 6-digit code sent to <span className={`font-bold ${t.textPrimary}`}>{formData.email}</span></>
                    : 'Start coding collaboratively in seconds'}
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
                      <label htmlFor="signup-name" className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
                        Username
                      </label>
                      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${errors.name ? 'border-(--red)' : ''}`}>
                        <User size={16} className={`shrink-0 ${t.textMuted2}`} />
                        <input
                          id="signup-name"
                          type="text"
                          placeholder="Your username"
                          value={formData.name}
                          onChange={handleChange('name')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-(--ink) placeholder:text-(--muted) placeholder:font-normal"
                          autoComplete="username"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.name} />
                    </div>

                    <div>
                      <label htmlFor="signup-email" className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
                        Email address
                      </label>
                      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${errors.email ? 'border-(--red)' : ''}`}>
                        <Mail size={16} className={`shrink-0 ${t.textMuted2}`} />
                        <input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange('email')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-(--ink) placeholder:text-(--muted) placeholder:font-normal"
                          autoComplete="email"
                        />
                      </div>
                      <FieldError message={errors.email} />
                    </div>

                    <PasswordField
                      id="signup-password"
                      label="Password"
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={handleChange('password')}
                      show={showPassword}
                      setShow={setShowPassword}
                      error={errors.password}
                      autoComplete="new-password"
                      t={t}
                    />

                    <PasswordField
                      id="signup-confirm"
                      label="Confirm password"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={handleChange('confirmPassword')}
                      show={showConfirm}
                      setShow={setShowConfirm}
                      error={errors.confirmPassword}
                      autoComplete="new-password"
                      t={t}
                    />

                    <button type="submit" className={`${t.btnAccent} group w-full h-12 mt-1 text-[15px]`} disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Sending OTP...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Send OTP
                          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="signup-otp" className={`block text-[13px] font-bold mb-2 ${t.textSecondary}`}>
                        Email OTP
                      </label>
                      <div className={`flex items-center gap-3 rounded-lg bg-(--panel) border px-3.5 h-11 transition-colors focus-within:border-(--blue) hover:border-(--ink)/40 ${t.border} ${errors.otp ? 'border-(--red)' : ''}`}>
                        <KeyRound size={16} className={`shrink-0 ${t.textMuted2}`} />
                        <input
                          id="signup-otp"
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
                        We only create your account after the OTP is verified.
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
                          Verify and Create Account
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
                        Edit details
                      </button>
                    </div>
                  </>
                )}
              </form>

              <div className={`text-center mt-6 pt-5 border-t ${t.divider} text-[13px] ${t.textMuted2}`}>
                Already have an account?{' '}
                <Link to="/login" className="text-(--red) font-extrabold hover:underline">
                  Sign in
                </Link>
              </div>
            </div>

            <p className={`text-center font-mono text-[11px] mt-5 ${t.textMuted2}`}>
              {otpStep
                ? 'Use a Gmail app password on the server to deliver OTP emails reliably.'
                : 'By creating an account, you agree to our Terms of Service'}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
