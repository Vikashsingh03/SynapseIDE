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
import SynapseInteractiveBackground from '../components/SynapseInteractiveBackground';
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

function BrandPanel() {
  return (
    <aside className="hidden lg:flex w-[46%] flex-col justify-between p-12 border-r border-white/[0.07] bg-white/1.5 backdrop-blur-sm relative overflow-hidden">
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-violet-600/20 blur-[100px] animate-aurora" />

      <Link to="/" className="flex items-center gap-3 group w-fit relative">
        <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_0_28px_rgba(139,92,246,0.45)] group-hover:scale-105 transition-transform duration-200">
          <SynapseLogo size={24} color="#ffffff" nodeColor="#ffffff" />
        </div>
        <span className="font-display text-xl font-bold tracking-tight text-white uppercase">
          Synapse
        </span>
      </Link>

      <div className="relative">
        <p className="syn-eyebrow mb-5">Realtime collaborative IDE</p>
        <h1 className="font-display text-5xl font-bold tracking-tight text-white leading-[1.08] mb-5">
          Your multiplayer
          <br />
          <span className="syn-text-gradient-animated">code editor.</span>
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed max-w-md mb-10">
          Create a free account and start coding with your team in seconds —
          no setup, no config.
        </p>

        <div className="space-y-5">
          {HIGHLIGHTS.map((item, i) => (
            <div
              key={item.title}
              className="flex items-start gap-4 animate-fade-up"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center shrink-0">
                <item.icon size={18} className="text-violet-300" />
              </div>
              <div>
                <p className="text-white font-semibold text-[15px]">{item.title}</p>
                <p className="text-slate-500 text-sm mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* floating mock card */}
      <div className="relative">
        <div className="syn-glass rounded-2xl p-5 max-w-sm animate-float shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-2 font-mono text-[11px] text-slate-500">room · 2 peers online</span>
          </div>
          <div className="font-mono text-[12.5px] leading-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-linear-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">A</span>
              <span className="text-slate-400 text-[11px]">Aarav joined the room</span>
            </div>
            <p><span className="text-violet-400">const</span> <span className="text-slate-200">synapse</span> <span className="text-slate-500">=</span> <span className="text-amber-300">"realtime"</span><span className="text-slate-400">;</span></p>
            <p className="relative"><span className="text-slate-600">// Neura AI is reviewing…</span><span className="absolute -right-1 top-1 w-[2px] h-4 bg-violet-400 animate-blink" /></p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-red-400 mt-1.5 animate-fade-in">{message}</p>;
}

function PasswordField({ id, label, placeholder, value, onChange, show, setShow, error, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-400 mb-2">
        {label}
      </label>
      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${error ? 'border-red-500/50!' : ''}`}>
        <Lock size={18} className="text-slate-500 shrink-0" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -m-1"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export default function Signup() {
  const { completeSignup } = useAuth();
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
    document.body.style.backgroundColor = '#05070d';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

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
    <div className="min-h-screen bg-void text-slate-200 syn-noise relative overflow-hidden">
      <SynapseInteractiveBackground />

      {/* aurora orbs */}
      <div className="pointer-events-none fixed inset-0 z-1">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-violet-600/25 blur-[120px] animate-aurora" />
        <div className="absolute -bottom-40 -right-24 h-112 w-md rounded-full bg-indigo-600/20 blur-[130px] animate-aurora" style={{ animationDelay: '-8s' }} />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 rounded-full bg-cyan-500/10 blur-[110px] animate-aurora" style={{ animationDelay: '-14s' }} />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <BrandPanel />

        {/* form side */}
        <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-107.5 animate-scale-in">
            <Link to="/" className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.4)]">
                <SynapseLogo size={22} color="#ffffff" nodeColor="#ffffff" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white uppercase">Synapse</span>
            </Link>

            <div className="syn-glass rounded-3xl p-8 sm:p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)]">
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
                  {otpStep ? <KeyRound size={22} className="text-violet-300" /> : <UserPlus size={22} className="text-violet-300" />}
                </div>
                <h1 className="font-display text-[28px] font-bold tracking-tight text-white mb-2">
                  {otpStep ? 'Verify your email' : 'Create your account'}
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {otpStep
                    ? <>Enter the 6-digit code sent to <span className="text-slate-200 font-medium">{formData.email}</span></>
                    : 'Start coding collaboratively in seconds'}
                </p>
              </div>

              {statusMessage && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 text-[13px] mb-6 animate-fade-in">
                  <Mail size={16} className="shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {serverError && (
                <div key={serverError} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-[13px] mb-6 animate-[authShake_0.4s_ease-out]">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={otpStep ? handleVerifyOtp : handleRequestOtp} className="flex flex-col gap-5" noValidate>
                {!otpStep ? (
                  <>
                    <div>
                      <label htmlFor="signup-name" className="block text-[13px] font-medium text-slate-400 mb-2">
                        Username
                      </label>
                      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${errors.name ? 'border-red-500/50!' : ''}`}>
                        <User size={18} className="text-slate-500 shrink-0" />
                        <input
                          id="signup-name"
                          type="text"
                          placeholder="Your username"
                          value={formData.name}
                          onChange={handleChange('name')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600"
                          autoComplete="username"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.name} />
                    </div>

                    <div>
                      <label htmlFor="signup-email" className="block text-[13px] font-medium text-slate-400 mb-2">
                        Email address
                      </label>
                      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${errors.email ? 'border-red-500/50!' : ''}`}>
                        <Mail size={18} className="text-slate-500 shrink-0" />
                        <input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange('email')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600"
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
                    />

                    <button type="submit" className="syn-btn-primary w-full h-13 rounded-xl text-[15px] mt-1" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <span className="w-4.5 h-4.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Sending OTP...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Send OTP
                          <ArrowRight size={18} />
                        </span>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="signup-otp" className="block text-[13px] font-medium text-slate-400 mb-2">
                        Email OTP
                      </label>
                      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${errors.otp ? 'border-red-500/50!' : ''}`}>
                        <KeyRound size={18} className="text-slate-500 shrink-0" />
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
                          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600 font-mono tracking-[0.3em]"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.otp} />
                      <p className="text-xs text-slate-600 mt-2">
                        We only create your account after the OTP is verified.
                      </p>
                    </div>

                    <button type="submit" className="syn-btn-primary w-full h-13 rounded-xl text-[15px] mt-1" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <span className="w-4.5 h-4.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Verifying OTP...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Verify and Create Account
                          <ArrowRight size={18} />
                        </span>
                      )}
                    </button>

                    <div className="flex items-center justify-between">
                      <button type="button" onClick={handleResendOtp} disabled={isLoading} className="text-[13px] font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors">
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
                        className="text-[13px] font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
                      >
                        Edit details
                      </button>
                    </div>
                  </>
                )}
              </form>

              <div className="text-center mt-7 pt-6 border-t border-white/[0.07] text-[13px] text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                  Sign in
                </Link>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-600 mt-6 tracking-wide">
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
