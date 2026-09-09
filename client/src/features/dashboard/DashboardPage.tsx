import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApi, documentApi } from '../../lib/api';
import type { Customer, FilteredDocument, DashboardFilters } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';
import { useSSE } from '../../hooks/useSSE';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'CRITICAL', label: 'Critical (≤ 7 Days)' },
  { value: 'DUE_SOON', label: 'Due Soon (≤ 15 Days)' },
  { value: 'UPCOMING', label: 'Upcoming (≤ 30 Days)' },
  { value: 'EXPIRES_TODAY', label: 'Expires Today' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'ACTIVE', label: 'Active' },
];

const inputStyle = {
  backgroundColor: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)',
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 hover:border-indigo-300/60';

const getInitials = (first?: string, second?: string) =>
  `${first?.charAt(0) ?? ''}${second?.charAt(0) ?? ''}`.toUpperCase() || '?';

export default function DashboardPage() {
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [filterResults, setFilterResults] = useState<FilteredDocument[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterPagination, setFilterPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Active mode
  const [mode, setMode] = useState<'idle' | 'search' | 'filter'>('idle');

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      if (mode === 'search') setMode('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setMode('search');
      try {
        const result = await customerApi.search(searchQuery.trim());
        setSearchResults(result.data);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Apply filters
  const applyFilters = useCallback(async () => {
    setIsFiltering(true);
    setMode('filter');
    try {
      const result = await documentApi.filter({
        ...filters,
        page: filterPagination.page,
        limit: 20,
      });
      setFilterResults(result.data);
      setFilterPagination({
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        total: result.pagination.total,
      });
    } catch {
      setFilterResults([]);
    } finally {
      setIsFiltering(false);
    }
  }, [filters, filterPagination.page]);

  const clearFilters = () => {
    setFilters({});
    setFilterResults([]);
    setFilterPagination({ page: 1, totalPages: 1, total: 0 });
    setMode('idle');
  };

  // Real-time updates via SSE
  useSSE((event) => {
    if (event.type === 'CUSTOMER_UPDATE' || event.type === 'DOCUMENT_UPDATE') {
      console.log('Real-time event received, reloading search/filter data...');
      if (mode === 'search' && searchQuery.trim()) {
        customerApi.search(searchQuery.trim()).then(r => setSearchResults(r.data)).catch(console.error);
      } else if (mode === 'filter') {
        documentApi.filter({ ...filters, page: filterPagination.page }).then(r => setFilterResults(r.data)).catch(console.error);
      }
    }
  });

  const hasActiveFilters = filters.documentName || filters.status || filters.dateFrom || filters.dateTo;
  const activeFilterCount = [filters.documentName, filters.status, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-2xl shadow-indigo-500/30">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/80 bg-white/15 backdrop-blur px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Document Tracker
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Stay ahead of every expiry
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl">
            Find customers instantly or filter documents by status and date to catch renewals before they lapse.
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="glass-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Quick Search
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Results appear as you type
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-focus-within:opacity-40 blur transition-opacity duration-300 pointer-events-none" />
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-indigo-500"
              style={{ color: 'var(--color-text-muted)' }}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone number, or vehicle number..."
              className="w-full pl-12 pr-12 py-4 rounded-2xl text-sm transition-all focus:outline-none"
              style={inputStyle}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-mono px-2 py-1 rounded-md"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                Type to search
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="glass-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500" />
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                Advanced Expiry Filters
                {activeFilterCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                    {activeFilterCount}
                  </span>
                )}
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Narrow down documents by name, status, or date range
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Clear All
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {/* Document Name Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Document Name
            </label>
            <input
              type="text"
              placeholder="e.g. Insurance, FC, Tax..."
              value={filters.documentName || ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  documentName: e.target.value || undefined,
                }))
              }
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value || undefined,
                }))
              }
              className={`${inputClass} cursor-pointer`}
              style={inputStyle}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Expiry Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Expiry Date To
            </label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={applyFilters}
            disabled={isFiltering}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
          >
            {isFiltering ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
                </svg>
                Apply Expiry Filter
              </>
            )}
          </button>
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {filters.documentName && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 font-medium">
                  {filters.documentName}
                </span>
              )}
              {filters.status && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-500 font-medium">
                  {STATUS_OPTIONS.find((o) => o.value === filters.status)?.label}
                </span>
              )}
              {filters.dateFrom && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-500 font-medium">
                  From {filters.dateFrom}
                </span>
              )}
              {filters.dateTo && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-500 font-medium">
                  To {filters.dateTo}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {mode === 'search' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              Search Results
              {searchResults.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500">
                  {searchResults.length}
                </span>
              )}
            </h3>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              for "{searchQuery}"
            </span>
          </div>

          {isSearching ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card p-5 flex items-start gap-4">
                  <div className="shimmer h-12 w-12 rounded-xl shrink-0" />
                  <div className="flex-1">
                    <div className="shimmer h-5 w-32 rounded mb-2" />
                    <div className="shimmer h-4 w-24 rounded mb-3" />
                    <div className="shimmer h-4 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-14 glass-card">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                </svg>
              </div>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                No customers found for "{searchQuery}"
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Try searching with a different name, phone number, or vehicle number
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((customer) => {
                const isSameName = searchResults.some(
                  (other) =>
                    other.id !== customer.id &&
                    ((customer.firstName && other.firstName && customer.firstName.trim().toLowerCase() === other.firstName.trim().toLowerCase() &&
                      (customer.secondName || '').trim().toLowerCase() === (other.secondName || '').trim().toLowerCase()) ||
                     (customer.fullName && other.fullName && customer.fullName.trim().toLowerCase() === other.fullName.trim().toLowerCase()))
                );

                const vehicles = (customer.vehicles && customer.vehicles.length > 0)
                  ? customer.vehicles
                  : customer.vehicleNumber
                  ? [{ id: 'legacy', vehicleNumber: customer.vehicleNumber, vehicleType: customer.vehicleType, status: 'Active' }]
                  : [];

                return (
                  <div
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className={`group glass-card p-5 cursor-pointer relative overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ${
                      isSameName
                        ? 'border-2 border-amber-400/90 dark:border-amber-500/80 shadow-md shadow-amber-500/10'
                        : 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-indigo-500/10'
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                      isSameName ? 'from-amber-500 via-orange-500 to-amber-500' : 'from-indigo-500 to-purple-500'
                    } scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300`} />
                    
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-md ${
                        isSameName
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
                          : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
                      }`}>
                        {getInitials(customer.firstName, customer.secondName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {customer.firstName} {customer.secondName}
                          </h4>
                          {isSameName && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Same Name
                            </span>
                          )}
                        </div>

                        {/* Mobile Number / Primary Key Highlight */}
                        <div className="mt-1.5">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                            isSameName
                              ? 'bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-2 border-amber-500 font-mono font-bold shadow-xs'
                              : 'text-sm text-slate-600 dark:text-slate-400'
                          }`}>
                            <svg className={`w-3.5 h-3.5 ${isSameName ? 'text-amber-600 dark:text-amber-400 animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                            </svg>
                            <span className={isSameName ? 'font-mono tracking-wider' : ''}>
                              {customer.phoneNumber}
                            </span>
                            {isSameName && (
                              <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white tracking-normal">
                                Primary Key
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <svg
                        className="w-5 h-5 shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-indigo-500"
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </div>

                    {/* Vehicles Section: Display below each other when 2 or more */}
                    {vehicles.length >= 2 ? (
                      <div className="mt-4 pt-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Vehicles ({vehicles.length})
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Multi-Vehicle
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {vehicles.map((v, vIdx) => (
                            <div
                              key={v.id || vIdx}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                                  {vIdx + 1}
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider">
                                  {v.vehicleNumber}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {v.vehicleType && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                    {v.vehicleType}
                                  </span>
                                )}
                                {v.status && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    v.status === 'Active'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                      : v.status === 'Expired'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                                  }`}>
                                    {v.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : vehicles.length === 1 ? (
                      <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Vehicle
                          </span>
                          {vehicles[0].vehicleType && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                              {vehicles[0].vehicleType}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tracking-wider border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                          {vehicles[0].vehicleNumber}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                          Vehicle
                        </span>
                        <span className="text-xs text-slate-400 italic">None</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode === 'filter' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              Filter Results
              {filterResults.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-500">
                  {filterPagination.total}
                </span>
              )}
            </h3>
            {filterResults.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Showing {filterResults.length} of {filterPagination.total} · Page {filterPagination.page} / {filterPagination.totalPages}
              </span>
            )}
          </div>

          {isFiltering ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card p-4 flex items-center gap-4">
                  <div className="shimmer h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="shimmer h-4 w-48 rounded" />
                    <div className="shimmer h-3 w-32 rounded" />
                  </div>
                  <div className="shimmer h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filterResults.length === 0 ? (
            <div className="text-center py-14 glass-card">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </div>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                No documents match the selected filters
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Try widening the date range or choosing a different status
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filterResults.map((doc, index) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/customers/${doc.customer.id}`)}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className="group glass-card p-4 flex items-center gap-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300"
                >
                  <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-base text-white bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                    {doc.documentName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {doc.customer.firstName} {doc.customer.secondName}
                      </p>
                      <span
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md tracking-wider"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                      >
                        {doc.customer.vehicleNumber}
                      </span>
                    </div>
                    <p className="text-xs mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="font-semibold text-indigo-500">{doc.documentName}</span>
                      <span className="opacity-40">•</span>
                      <span>{new Date(doc.startDate).toLocaleDateString('en-IN')}</span>
                      <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                      <span>{new Date(doc.endDate).toLocaleDateString('en-IN')}</span>
                    </p>
                    {doc.notes && (
                      <p className="text-[11px] mt-1 text-slate-500 italic truncate" title={doc.notes}>
                        <span className="font-semibold text-slate-600 dark:text-slate-400 not-italic">Note:</span> {doc.notes}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} compact />
                  <svg
                    className="w-4 h-4 shrink-0 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500"
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'idle' && (
        <div className="glass-card p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center">
                <svg className="w-11 h-11 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Search or filter across your entire database
            </h3>
            <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
              Use the search bar above or apply filters to track expiring documents across all customers
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-10 text-left">
              {[
                { title: 'Instant lookup', desc: 'Find any customer by name, phone, or vehicle number.', color: 'from-indigo-500 to-blue-500' },
                { title: 'Expiry tracking', desc: 'Spot critical, due soon, and expired documents at a glance.', color: 'from-purple-500 to-fuchsia-500' },
                { title: 'Date ranges', desc: 'Plan renewals by filtering expiry dates within any window.', color: 'from-fuchsia-500 to-rose-500' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}
                >
                  <div className={`w-8 h-1.5 rounded-full bg-gradient-to-r ${item.color} mb-3`} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
