import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../lib/api';
import type { DashboardStats, FilteredDocument } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';

const QUICK_LINKS = [
  {
    to: '/customers',
    title: 'Customer Directory',
    desc: 'Search, edit, and view individual profiles',
    gradient: 'from-indigo-500 to-blue-500',
    soft: 'bg-indigo-500/10 text-indigo-500',
    hover: 'group-hover:text-indigo-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    ),
  },
  {
    to: '/documents',
    title: 'Master Document Expiry',
    desc: 'Filter by Insurance, FC, Tax, or validity',
    gradient: 'from-purple-500 to-fuchsia-500',
    soft: 'bg-purple-500/10 text-purple-500',
    hover: 'group-hover:text-purple-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    ),
  },
  {
    to: '/notifications',
    title: 'Notification Dispatcher',
    desc: 'WhatsApp & SMS reminder delivery audit',
    gradient: 'from-teal-500 to-cyan-500',
    soft: 'bg-teal-500/10 text-teal-500',
    hover: 'group-hover:text-teal-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    ),
  },
  {
    to: '/renewals',
    title: 'Renewal Audit Logs',
    desc: 'Inspect full history of date updates',
    gradient: 'from-emerald-500 to-lime-500',
    soft: 'bg-emerald-500/10 text-emerald-500',
    hover: 'group-hover:text-emerald-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    ),
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expiringDocs, setExpiringDocs] = useState<FilteredDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statsData, expiringData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getExpiringDocuments(8),
      ]);
      setStats(statsData);
      setExpiringDocs(expiringData);
    } catch (error) {
      console.error('Failed to load home dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTriggerCheck = async () => {
    try {
      setIsChecking(true);
      setCheckMessage('');
      const res = await dashboardApi.triggerCheck();
      setCheckMessage(res.message);
      await loadData();
    } catch (error) {
      console.error(error);
      setCheckMessage('Failed to run expiry check');
    } finally {
      setIsChecking(false);
    }
  };

  // Derived numbers for the compliance ring (pure render math)
  const totalTracked = (stats?.criticalCount ?? 0) + (stats?.expiringSoonCount ?? 0);
  const critical = stats?.criticalCount ?? 0;
  const healthPct = totalTracked === 0 ? 100 : Math.round(((totalTracked - critical) / totalTracked) * 100);
  const ringCircumference = 2 * Math.PI * 36;
  const ringOffset = ringCircumference * (1 - healthPct / 100);

  const kpis = [
    {
      label: 'Total Customers',
      value: stats?.totalCustomers ?? 0,
      tag: 'Active Fleet',
      gradient: 'from-indigo-500 to-blue-500',
      soft: 'bg-indigo-500/10 text-indigo-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      ),
    },
    {
      label: 'Critical (≤ 7 Days)',
      value: stats?.criticalCount ?? 0,
      tag: 'Action Required',
      gradient: 'from-rose-500 to-orange-500',
      soft: 'bg-rose-500/10 text-rose-500',
      pulse: true,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      ),
    },
    {
      label: 'Expired',
      value: stats?.expiredCount ?? 0,
      tag: 'Action Required',
      gradient: 'from-red-500 to-rose-600',
      soft: 'bg-red-500/10 text-red-500',
      pulse: true,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      ),
    },
    {
      label: 'Total Renewals',
      value: stats?.totalRenewals ?? 0,
      tag: 'Completed',
      gradient: 'from-emerald-500 to-lime-500',
      soft: 'bg-emerald-500/10 text-emerald-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <style>{`
        @keyframes hp-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes hp-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes hp-ring { from { stroke-dashoffset: ${ringCircumference}; } }
        @keyframes hp-shine { from { transform: translateX(-100%) } to { transform: translateX(200%) } }
        .hp-fade-up { animation: hp-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .hp-float { animation: hp-float 7s ease-in-out infinite; }
        .hp-ring { animation: hp-ring 1.2s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .hp-shine::after {
          content: ''; position: absolute; inset: 0; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: translateX(-100%);
        }
        .hp-shine:hover::after { animation: hp-shine 0.8s ease; }
      `}</style>

      {/* Hero */}
      <div className="hp-fade-up relative overflow-hidden rounded-3xl p-8 md:p-10 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 shadow-2xl shadow-indigo-500/30 text-white">
        <div className="hp-float absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="hp-float absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" style={{ animationDelay: '2s' }} />
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />

        <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-100 text-xs font-semibold mb-4">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              Automated Expiry & Notification Engine Active
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Future Driving School
            </h1>
            <p className="text-indigo-100/90 text-sm md:text-base mt-3 max-w-xl">
              Real-time fleet compliance management, automated WhatsApp & SMS reminders, and instant renewal tracking.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Link
                to="/customers/new"
                className="hp-shine relative overflow-hidden inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Register Customer
              </Link>
              <button
                onClick={handleTriggerCheck}
                disabled={isChecking}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 font-semibold text-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {isChecking ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Checking Expiries...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 2 3 14h8l-1 8 11-14h-8l1-6Z" />
                    </svg>
                    Run Expiry Check
                  </>
                )}
              </button>
            </div>

            {checkMessage && (
              <div className="hp-fade-up mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-medium backdrop-blur-md border border-white/20">
                <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {checkMessage}
              </div>
            )}
          </div>

          {/* Compliance Ring */}
          <div className="hidden lg:flex items-center gap-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 min-w-[260px]">
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
                {!isLoading && (
                  <circle
                    key={healthPct}
                    className="hp-ring"
                    cx="40" cy="40" r="36" fill="none"
                    stroke="url(#hp-ring-grad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                )}
                <defs>
                  <linearGradient id="hp-ring-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold leading-none">{isLoading ? '…' : `${healthPct}%`}</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-indigo-100/80 font-semibold">Compliance Health</p>
              <p className="text-sm font-bold mt-1">
                {isLoading ? 'Calculating…' : critical === 0 ? 'All clear' : `${critical} critical`}
              </p>
              <p className="text-xs text-indigo-100/70 mt-0.5">
                {isLoading ? '' : `${totalTracked} document${totalTracked === 1 ? '' : 's'} in 30d window`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className="hp-fade-up group glass-card relative overflow-hidden p-5 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${kpi.gradient}`} />
            <div className={`absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-[0.07] group-hover:opacity-[0.16] group-hover:scale-125 transition-all duration-500`} />

            <div className="relative flex items-start justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider leading-tight" style={{ color: 'var(--color-text-muted)' }}>
                {kpi.label}
              </p>
              <div className={`relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${kpi.soft} group-hover:scale-110 transition-transform`}>
                {kpi.pulse && !isLoading && kpi.value > 0 && (
                  <span className="absolute inset-0 rounded-xl bg-rose-500/30 animate-ping" style={{ animationDuration: '2.5s' }} />
                )}
                <svg className="relative w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  {kpi.icon}
                </svg>
              </div>
            </div>

            <div className="relative mt-3">
              {isLoading ? (
                <div className="shimmer h-9 w-20 rounded-lg" />
              ) : (
                <p
                  key={kpi.value}
                  className={`hp-fade-up text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r ${kpi.gradient} bg-clip-text text-transparent`}
                >
                  {kpi.value.toLocaleString('en-IN')}
                </p>
              )}
              <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${kpi.soft}`}>{kpi.tag}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expiring Documents */}
        <div className="hp-fade-up lg:col-span-2 space-y-4" style={{ animationDelay: '460ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                  Urgent & Expiring Documents
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {isLoading ? 'Loading…' : `${expiringDocs.length} item${expiringDocs.length === 1 ? '' : 's'} need attention`}
                </p>
              </div>
            </div>
            <Link
              to="/documents"
              className="group inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors"
            >
              View All
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>

          <div className="glass-card overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-2">
                    <div className="shimmer w-11 h-11 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="shimmer h-4 w-48 rounded" />
                      <div className="shimmer h-3 w-32 rounded" />
                    </div>
                    <div className="shimmer h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : expiringDocs.length === 0 ? (
              <div className="p-14 text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="relative w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                </div>
                <p className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>All Documents Compliant!</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>No documents expiring within the next 30 days.</p>
              </div>
            ) : (
              <div>
                {expiringDocs.map((doc, index) => (
                  <div
                    key={doc.id}
                    className="hp-fade-up group relative p-4 flex items-center justify-between gap-4 hover:bg-indigo-500/[0.04] transition-colors"
                    style={{ animationDelay: `${index * 45}ms`, borderBottom: index < expiringDocs.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                  >
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />

                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                        {doc.documentName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/customers/${doc.customer.id}`}
                            className="font-bold text-sm hover:text-indigo-500 transition-colors truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {doc.customer.firstName} {doc.customer.secondName}
                          </Link>
                          <span
                            className="font-mono text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md"
                            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                          >
                            {doc.customer.vehicleNumber}
                          </span>
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="font-semibold text-indigo-500">{doc.documentName}</span>
                          <span className="opacity-40">•</span>
                          <span>Expiry: {new Date(doc.endDate).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} compact />
                      <Link
                        to={`/customers/${doc.customer.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90 hover:opacity-100 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Renew
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Operations */}
        <div className="hp-fade-up space-y-4" style={{ animationDelay: '540ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                Operations & Control
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Jump to any module</p>
            </div>
          </div>

          <div className="space-y-3">
            {QUICK_LINKS.map((item, i) => (
              <Link
                key={item.to}
                to={item.to}
                className="hp-fade-up group glass-card relative overflow-hidden p-4 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
                style={{ animationDelay: `${600 + i * 70}ms` }}
              >
                <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${item.gradient} scale-y-0 group-hover:scale-y-100 transition-transform origin-top`} />
                <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${item.soft} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    {item.icon}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm transition-colors ${item.hover}`} style={{ color: 'var(--color-text-primary)' }}>
                    {item.title}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                </div>
                <svg
                  className="w-4 h-4 shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                  style={{ color: 'var(--color-text-muted)' }}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
