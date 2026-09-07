import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../preset/WhatsApp.jpeg';

const FEATURES = [
  {
    title: 'Automated expiry alerts',
    desc: 'WhatsApp & SMS reminders sent before documents lapse.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    ),
  },
  {
    title: 'Fleet compliance at a glance',
    desc: 'Insurance, FC, Tax and more tracked in one dashboard.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    ),
  },
  {
    title: 'Full renewal history',
    desc: 'Every date update is logged and auditable.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password, rememberMe);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Login failed'
          : 'Network error. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-50">
      <style>{`
        @keyframes lp-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-float { 0%, 100% { transform: translate(0, 0) } 50% { transform: translate(12px, -18px) } }
        @keyframes lp-shake { 0%, 100% { transform: translateX(0) } 20%, 60% { transform: translateX(-5px) } 40%, 80% { transform: translateX(5px) } }
        @keyframes lp-shine { from { transform: translateX(-100%) } to { transform: translateX(250%) } }
        .lp-fade-up { animation: lp-fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .lp-float { animation: lp-float 9s ease-in-out infinite; }
        .lp-shake { animation: lp-shake 0.45s ease; }
        .lp-shine::after {
          content: ''; position: absolute; inset: 0; width: 35%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: translateX(-100%);
        }
        .lp-shine:hover:not(:disabled)::after { animation: lp-shine 0.9s ease; }
      `}</style>

      {/* Brand Panel (desktop) */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 text-white p-14 flex-col justify-between">
        <div className="lp-float absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="lp-float absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-fuchsia-400/25 blur-3xl pointer-events-none" style={{ animationDelay: '3s' }} />
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '26px 26px' }}
        />

        <div className="relative lp-fade-up">
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white shadow-lg shadow-black/20 ring-2 ring-white/30">
              <img src={logoImg} alt="Future Driving School" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-extrabold text-lg leading-tight">Future Driving School</p>
              <p className="text-xs text-indigo-100/80">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="lp-fade-up inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-100 text-xs font-semibold mb-6" style={{ animationDelay: '100ms' }}>
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            Expiry Engine Online
          </div>
          <h2 className="lp-fade-up text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight" style={{ animationDelay: '180ms' }}>
            Keep every vehicle<br />
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-200 bg-clip-text text-transparent">compliant, always.</span>
          </h2>
          <p className="lp-fade-up mt-4 text-indigo-100/85 max-w-md" style={{ animationDelay: '260ms' }}>
            Sign in to manage customers, track document expiries, and dispatch reminders from a single control center.
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="lp-fade-up group flex items-start gap-4 p-3 -mx-3 rounded-2xl hover:bg-white/10 transition-colors"
                style={{ animationDelay: `${340 + i * 90}ms` }}
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/25 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">{f.icon}</svg>
                </div>
                <div>
                  <p className="font-semibold text-sm">{f.title}</p>
                  <p className="text-xs text-indigo-100/75 mt-0.5">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-100/60 lp-fade-up" style={{ animationDelay: '700ms' }}>
          © {new Date().getFullYear()} Future Driving School. All rights reserved.
        </p>
      </div>

      {/* Form Panel */}
      <div className="flex-1 relative flex items-center justify-center px-6 py-12">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/60" />
        <div className="lp-float absolute top-0 right-0 w-[520px] h-[520px] bg-indigo-500/[0.06] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="lp-float absolute bottom-0 left-0 w-[380px] h-[380px] bg-purple-500/[0.06] rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" style={{ animationDelay: '4s' }} />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8 lp-fade-up">
            <div className="w-20 h-20 mx-auto mb-4 overflow-hidden rounded-2xl shadow-xl shadow-indigo-500/15 border border-white ring-1 ring-slate-100 bg-white">
              <img src={logoImg} alt="Future Driving School" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Future Driving School</h1>
            <p className="text-slate-400 text-sm mt-1">Admin Dashboard</p>
          </div>

          {/* Card */}
          <div className="lp-fade-up relative" style={{ animationDelay: '120ms' }}>
            <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-fuchsia-500/20 blur-xl pointer-events-none" />
            <div className="relative bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-500/10 p-8 sm:p-9 border border-white">
              <div className="absolute inset-x-8 top-0 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500" />

              <div className="mb-7">
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the dashboard.</p>
              </div>

              {error && (
                <div
                  key={error}
                  role="alert"
                  className="lp-shake mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-rose-100 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  </div>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
                {/* Username */}
                <div className="group">
                  <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      autoFocus
                      autoComplete="username"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="group">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <label htmlFor="remember-me" className="flex items-center gap-3 cursor-pointer select-none group w-fit">
                  <span className="relative inline-flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="w-10 h-6 rounded-full bg-slate-200 peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/20 transition-all duration-300" />
                    <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 peer-checked:translate-x-4" />
                  </span>
                  <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">Remember Me</span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || !username || !password}
                  id="login-button"
                  className="lp-shine relative overflow-hidden w-full py-3.5 px-4 rounded-xl text-white font-semibold text-[15px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:hover:from-indigo-600 disabled:hover:to-purple-600 transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/35"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Secure admin access only
              </div>
            </div>
          </div>

          <p className="lg:hidden text-center mt-6 text-slate-400 text-xs lp-fade-up" style={{ animationDelay: '300ms' }}>
            © {new Date().getFullYear()} Future Driving School. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
