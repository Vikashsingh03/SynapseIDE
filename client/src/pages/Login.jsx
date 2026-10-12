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
          Code together,
          <br />
          <span className="syn-text-gradient-animated">in real time.</span>
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed max-w-md mb-10">
          The multiplayer code editor with instant execution and an AI pair
          programmer built in.
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
            <span className="ml-2 font-mono text-[11px] text-slate-500">main.py — 3 online</span>
          </div>
          <div className="font-mono text-[12.5px] leading-6">
            <p><span className="text-violet-400">def</span> <span className="text-cyan-300">greet</span><span className="text-slate-400">():</span></p>
            <p className="pl-4 relative">
              <span className="text-slate-200">print(</span><span className="text-amber-300">"Hello, Synapse!"</span><span className="text-slate-200">)</span>
              <span className="absolute -right-1 top-1 w-0.5 h-4 bg-emerald-400 animate-blink" />
            </p>
            <p className="pl-4"><span className="text-slate-600"># Priya is typing…</span></p>
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

export default function Login() {
  const { completeLogin } = useAuth();
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
    document.body.style.backgroundColor = '#05070d';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

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
                  {otpStep ? <KeyRound size={22} className="text-violet-300" /> : <LogIn size={22} className="text-violet-300" />}
                </div>
                <h1 className="font-display text-[28px] font-bold tracking-tight text-white mb-2">
                  {otpStep ? 'Enter your OTP' : 'Welcome back'}
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {otpStep
                    ? <>Enter the 6-digit code sent to <span className="text-slate-200 font-medium">{formData.email}</span></>
                    : 'Sign in to continue to your workspace'}
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
                      <label htmlFor="login-email" className="block text-[13px] font-medium text-slate-400 mb-2">
                        Email address
                      </label>
                      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${errors.email ? 'border-red-500/50!' : ''}`}>
                        <Mail size={18} className="text-slate-500 shrink-0" />
                        <input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange('email')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600"
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.email} />
                    </div>

                    <div>
                      <label htmlFor="login-password" className="block text-[13px] font-medium text-slate-400 mb-2">
                        Password
                      </label>
                      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${errors.password ? 'border-red-500/50!' : ''}`}>
                        <Lock size={18} className="text-slate-500 shrink-0" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={handleChange('password')}
                          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -m-1"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <FieldError message={errors.password} />
                    </div>

                    <button type="submit" className="syn-btn-primary w-full h-13 rounded-xl text-[15px] mt-1" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <span className="w-4.5 h-4.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Sending OTP...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Continue with OTP
                          <ArrowRight size={18} />
                        </span>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="login-otp" className="block text-[13px] font-medium text-slate-400 mb-2">
                        Email OTP
                      </label>
                      <div className={`flex items-center gap-3 rounded-xl syn-input px-4 h-13 ${errors.otp ? 'border-red-500/50!' : ''}`}>
                        <KeyRound size={18} className="text-slate-500 shrink-0" />
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
                          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-100 placeholder:text-slate-600 font-mono tracking-[0.3em]"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                      </div>
                      <FieldError message={errors.otp} />
                      <p className="text-xs text-slate-600 mt-2">
                        Your password is checked first, then the OTP completes login.
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
                          Verify and Sign In
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
                        Change login details
                      </button>
                    </div>
                  </>
                )}
              </form>

              <div className="text-center mt-7 pt-6 border-t border-white/[0.07] text-[13px] text-slate-500">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                  Create one
                </Link>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-600 mt-6 tracking-wide">
              {otpStep ? 'JWT session starts only after OTP verification succeeds.' : 'Secure login powered by password + email OTP'}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
