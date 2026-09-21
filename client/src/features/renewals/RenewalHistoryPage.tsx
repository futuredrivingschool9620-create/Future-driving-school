import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { renewalApi } from '../../lib/api';
import type { RenewalHistory } from '../../types';
import { useVirtualTable } from '../../hooks/useVirtualTable';

export default function RenewalHistoryPage() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId') || '';

  const [renewals, setRenewals] = useState<RenewalHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Date range delete state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [isDeletingRange, setIsDeletingRange] = useState(false);

  // Delete all state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Single row delete state
  const [recordToDelete, setRecordToDelete] = useState<RenewalHistory | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Feedback notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { containerRef, visibleItems, topSpacerHeight, bottomSpacerHeight } = useVirtualTable({
    items: renewals,
    estimatedRowHeight: 64,
  });

  const fetchRenewals = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = customerId
        ? await renewalApi.getForCustomer(customerId, page, 15)
        : await renewalApi.getAll(page, 15);

      setRenewals(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to fetch renewals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, page]);

  useEffect(() => {
    fetchRenewals();
  }, [fetchRenewals]);

  // Toggle single row selection
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all on current page
  const toggleSelectAll = () => {
    if (selectedIds.size === renewals.length && renewals.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(renewals.map((r) => r.id)));
    }
  };

  // Handle open range modal validation
  const handleOpenRangeModal = () => {
    setErrorMessage('');
    if (!startDate || !endDate) {
      setErrorMessage('Please select both From Date and To Date to delete records.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMessage('From Date cannot be later than To Date.');
      return;
    }
    setShowRangeModal(true);
  };

  // Confirm range delete
  const handleConfirmDeleteRange = async () => {
    try {
      setIsDeletingRange(true);
      setErrorMessage('');
      const res = await renewalApi.deleteRange(startDate, endDate);
      setSuccessMessage(res.message || `Successfully deleted ${res.count} renewal records.`);
      setShowRangeModal(false);
      setStartDate('');
      setEndDate('');
      await fetchRenewals();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to delete renewal records.');
    } finally {
      setIsDeletingRange(false);
    }
  };

  // Confirm batch delete
  const handleConfirmDeleteBatch = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsDeletingBatch(true);
      setErrorMessage('');
      const res = await renewalApi.deleteBatch(Array.from(selectedIds));
      setSuccessMessage(res.message || `Successfully deleted ${res.count} renewal records.`);
      setShowBatchModal(false);
      setSelectedIds(new Set());
      await fetchRenewals();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to delete selected records.');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Confirm delete all
  const handleConfirmDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      setErrorMessage('');
      const res = await renewalApi.deleteAll();
      setSuccessMessage(res.message || 'All renewal history records have been cleared.');
      setShowDeleteAllModal(false);
      await fetchRenewals();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to delete all renewal records.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Confirm single row delete
  const handleConfirmDeleteSingle = async () => {
    if (!recordToDelete) return;
    try {
      setIsDeletingSingle(true);
      setErrorMessage('');
      const res = await renewalApi.delete(recordToDelete.id);
      setSuccessMessage(res.message || 'Renewal record deleted successfully.');
      setRecordToDelete(null);
      await fetchRenewals();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to delete renewal record.');
    } finally {
      setIsDeletingSingle(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Feedback */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold ml-2 text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold ml-2 text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Renewal History
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Complete audit trail of document renewals ({totalItems} records)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete Selected ({selectedIds.size})
            </button>
          )}

          {renewals.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/50 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 text-xs font-semibold rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete All
            </button>
          )}
        </div>
      </div>

      {/* Delete Range Controls Panel */}
      <div className="glass-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Delete Renewals by Date Range
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk delete all renewal history records between specific dates for all users
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="renewal-from-date" className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                From:
              </label>
              <input
                id="renewal-from-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="renewal-to-date" className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                To:
              </label>
              <input
                id="renewal-to-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setErrorMessage('');
                }}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title="Clear dates"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenRangeModal}
              disabled={!startDate || !endDate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete Range
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div ref={containerRef} className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50">
              <tr>
                <th className="w-10 px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === renewals.length && renewals.length > 0}
                    onChange={toggleSelectAll}
                    title="Select all on this page"
                    className="w-4 h-4 rounded text-rose-600 border-slate-300 dark:border-slate-700 focus:ring-rose-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Customer & Vehicle
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Old Period
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  New Period
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Renewed By / On
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white/50 dark:bg-slate-900/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-500">Loading renewal history...</p>
                  </td>
                </tr>
              ) : renewals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </div>
                    <p className="text-slate-900 dark:text-white font-medium text-lg">No renewals recorded yet</p>
                    <p className="text-slate-500 mt-1">When documents are renewed, previous validity periods and admin details are tracked here.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {topSpacerHeight > 0 && (
                    <tr style={{ height: topSpacerHeight, border: 0 }}><td colSpan={7} style={{ height: topSpacerHeight, padding: 0, border: 0 }} /></tr>
                  )}
                  {visibleItems.map(({ item: r }) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors ${
                        selectedIds.has(r.id) ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="w-10 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelectRow(r.id)}
                          className="w-4 h-4 rounded text-rose-600 border-slate-300 dark:border-slate-700 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {r.customer ? `${r.customer.firstName} ${r.customer.secondName}` : 'Customer'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {r.customer?.vehicleNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">
                          {r.oldDocumentName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(r.oldStartDate).toLocaleDateString('en-IN')} &rarr;{' '}
                        <span className="line-through text-red-400">
                          {new Date(r.oldEndDate).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900 dark:text-slate-200">
                        {new Date(r.newStartDate).toLocaleDateString('en-IN')} &rarr;{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {new Date(r.newEndDate).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.admin?.username || 'Admin'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(r.renewalDate).toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                        <button
                          type="button"
                          onClick={() => setRecordToDelete(r)}
                          title="Delete this renewal record"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {bottomSpacerHeight > 0 && (
                    <tr style={{ height: bottomSpacerHeight, border: 0 }}><td colSpan={7} style={{ height: bottomSpacerHeight, padding: 0, border: 0 }} /></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Range Delete Confirmation Modal */}
      {showRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete Renewals in Date Range?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">From Date:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{startDate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">To Date:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{endDate}</span>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                All renewal history entries recorded within this period across all users will be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingRange}
                onClick={() => setShowRangeModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRange}
                onClick={handleConfirmDeleteRange}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeletingRange ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Confirm & Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete {selectedIds.size} Selected Records?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Delete all selected renewal history records.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete the <strong>{selectedIds.size}</strong> selected renewal history records? This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={handleConfirmDeleteBatch}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeletingBatch ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  `Delete ${selectedIds.size} Records`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete ALL Renewal Records?
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  Warning: Entire renewal audit history will be deleted!
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              This will permanently delete all <strong>{totalItems}</strong> renewal history records across all customers in the database.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={handleConfirmDeleteAll}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeletingAll ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting All...
                  </>
                ) : (
                  'Yes, Delete Everything'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Record Delete Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete Renewal Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Delete this specific renewal history entry.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Customer:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {recordToDelete.customer ? `${recordToDelete.customer.firstName} ${recordToDelete.customer.secondName}` : 'Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Document:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{recordToDelete.oldDocumentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Renewal Date:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(recordToDelete.renewalDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={handleConfirmDeleteSingle}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeletingSingle ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
