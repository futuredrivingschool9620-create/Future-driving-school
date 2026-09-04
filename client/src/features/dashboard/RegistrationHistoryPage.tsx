import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../../lib/api';
import type { RegistrationHistoryResponse } from '../../types';


export default function RegistrationHistoryPage() {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<RegistrationHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await dashboardApi.getRegistrationHistory(startDate, endDate);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch registration history', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Derived values for inline bar visuals (pure render math, no extra state)
  const history = data?.history ?? [];
  const maxCustomers = Math.max(1, ...history.map((h) => h.customers));
  const maxDocuments = Math.max(1, ...history.map((h) => h.documents));
  const maxReminders = Math.max(1, ...history.map((h) => h.reminders));

  const summaryCards = [
    {
      label: 'Total Customers',
      value: data?.totalCustomers ?? 0,
      tag: 'Registered',
      gradient: 'from-teal-500 to-cyan-500',
      soft: 'bg-teal-500/10 text-teal-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      ),
    },
    {
      label: 'Total Documents',
      value: data?.totalDocuments ?? 0,
      tag: 'Registered',
      gradient: 'from-indigo-500 to-purple-500',
      soft: 'bg-indigo-500/10 text-indigo-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      ),
    },
    {
      label: 'Total Reminders',
      value: data?.totalReminders ?? 0,
      tag: 'Sent',
      gradient: 'from-emerald-500 to-lime-500',
      soft: 'bg-emerald-500/10 text-emerald-500',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Local keyframes for entrance animations */}
      <style>{`
        @keyframes rh-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rh-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .rh-fade-up { animation: rh-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .rh-grow { animation: rh-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: left; }
      `}</style>

      {/* Header */}
      <div className="rh-fade-up relative overflow-hidden rounded-3xl p-7 sm:p-9 bg-gradient-to-br from-teal-600 via-indigo-600 to-purple-600 text-white shadow-2xl shadow-indigo-500/25">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/80 bg-white/15 backdrop-blur px-3 py-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              Analytics
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">Registration History</h1>
            <p className="mt-2 text-sm sm:text-base text-white/80 max-w-lg">
              Track new customers, documents, and reminders added over time
            </p>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-2xl p-2 border border-white/20 shadow-lg self-start md:self-auto">
            <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/10 transition-colors cursor-pointer">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm font-semibold bg-transparent text-white border-none outline-none focus:ring-0 p-0 [color-scheme:dark] cursor-pointer"
              />
            </label>
            <span className="w-px h-6 bg-white/25" />
            <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/10 transition-colors cursor-pointer">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm font-semibold bg-transparent text-white border-none outline-none focus:ring-0 p-0 [color-scheme:dark] cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card, i) => (
          <div
            key={card.label}
            className="rh-fade-up group glass-card relative overflow-hidden p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300"
            style={{ animationDelay: `${100 + i * 80}ms` }}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.gradient}`} />
            <div className={`absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.07] group-hover:opacity-[0.14] group-hover:scale-125 transition-all duration-500`} />

            <div className="relative flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {card.label}
              </p>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.soft} group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  {card.icon}
                </svg>
              </div>
            </div>

            <div className="relative mt-3 flex items-end gap-3">
              {isLoading ? (
                <div className="shimmer h-10 w-24 rounded-lg" />
              ) : (
                <p
                  key={card.value}
                  className={`rh-fade-up text-4xl font-extrabold tracking-tight bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}
                >
                  {card.value.toLocaleString('en-IN')}
                </p>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${card.soft}`}>{card.tag}</span>
            </div>
          </div>
        ))}
      </div>

      {/* History Table */}
      <div className="rh-fade-up glass-card overflow-hidden" style={{ animationDelay: '340ms' }}>
        <div
          className="px-6 py-5 flex items-center justify-between flex-wrap gap-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
              <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>Daily Breakdown</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {isLoading ? 'Loading...' : `${history.length} day${history.length === 1 ? '' : 's'} with activity`}
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500" />Customers</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Documents</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Reminders</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 py-2">
                <div className="shimmer h-4 w-40 rounded" />
                <div className="shimmer h-6 w-16 rounded-full" />
                <div className="shimmer h-6 w-16 rounded-full" />
                <div className="shimmer h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : !data || data.history.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <p className="font-semibold text-lg" style={{ color: 'var(--color-text-secondary)' }}>
              No registrations found in this period.
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Try selecting a wider date range above
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Date', 'Customers Registered', 'Documents Registered', 'Reminders Sent'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.map((item, index) => {
                  const d = new Date(item.date);
                  return (
                    <tr
                      key={item.date}
                      className="rh-fade-up group hover:bg-indigo-500/[0.04] transition-colors"
                      style={{ animationDelay: `${index * 35}ms`, borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex flex-col items-center justify-center leading-none group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}
                          >
                            <span className="text-[9px] font-bold uppercase text-indigo-500">
                              {d.toLocaleDateString('en-IN', { month: 'short' })}
                            </span>
                            <span className="text-base font-extrabold" style={{ color: 'var(--color-text-primary)' }}>
                              {d.toLocaleDateString('en-IN', { day: 'numeric' })}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                            +{item.customers}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                            <div
                              className="rh-grow h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400"
                              style={{ width: `${(item.customers / maxCustomers) * 100}%`, animationDelay: `${index * 35 + 200}ms` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                            +{item.documents}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                            <div
                              className="rh-grow h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400"
                              style={{ width: `${(item.documents / maxDocuments) * 100}%`, animationDelay: `${index * 35 + 250}ms` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            {item.reminders}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                            <div
                              className="rh-grow h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
                              style={{ width: `${(item.reminders / maxReminders) * 100}%`, animationDelay: `${index * 35 + 300}ms` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
