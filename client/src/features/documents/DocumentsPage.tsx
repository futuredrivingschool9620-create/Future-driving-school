import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { documentApi } from '../../lib/api';
import type { FilteredDocument } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';
import ExportDocumentsModal from './ExportDocumentsModal';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<FilteredDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Renewal state
  const [renewingDoc, setRenewingDoc] = useState<FilteredDocument | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await documentApi.filter({
        status: statusFilter || undefined,
        documentName: nameFilter || undefined,
        page,
        limit: 15,
      });

      setDocuments(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, nameFilter, page]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openRenewalModal = (doc: FilteredDocument) => {
    setRenewingDoc(doc);
    // Auto-populate tomorrow or today as start date, and +1 year as end date
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setNewStartDate(today);
    setNewEndDate(nextYear.toISOString().split('T')[0]);
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingDoc) return;
    try {
      setIsSubmittingRenewal(true);
      await documentApi.renew(renewingDoc.id, {
        newStartDate,
        newEndDate,
        renewalType: renewingDoc.daysRemaining > 30 ? 'PRE_RENEWAL' : 'NORMAL',
      });
      setRenewingDoc(null);
      fetchDocuments();
    } catch (error) {
      console.error('Renewal failed:', error);
      alert('Failed to renew document. Please check dates.');
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            All Documents & Expiry Control
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Manage, filter, and renew documents across all customers ({totalItems} records)
          </p>
        </div>

        {/* Quick Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by doc name (e.g. Insurance)..."
            value={nameFilter}
            onChange={(e) => {
              setNameFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70"
            style={{ color: 'var(--color-text-primary)' }}
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <option value="">All Statuses</option>
            <option value="CRITICAL">Critical (&le; 7 Days)</option>
            <option value="DUE_SOON">Due Soon (&le; 15 Days)</option>
            <option value="UPCOMING">Upcoming (&le; 30 Days)</option>
            <option value="EXPIRES_TODAY">Expires Today</option>
            <option value="EXPIRED">Expired</option>
            <option value="ACTIVE">Active</option>
          </select>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Documents
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Customer & Vehicle
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Validity Range
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Notes / Remarks
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white/50 dark:bg-slate-900/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-500">Loading documents...</p>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-slate-900 dark:text-white font-medium text-lg">No documents found</p>
                    <p className="text-slate-500 mt-1">Try adjusting the filter criteria.</p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/customers/${doc.customer.id}`}
                        className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {doc.customer.firstName} {doc.customer.secondName}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {doc.customer.vehicleNumber} &bull; {doc.customer.phoneNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {doc.documentName}
                        {doc.renewalVersion > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-normal">
                            v{doc.renewalVersion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                      <div>Start: {new Date(doc.startDate).toLocaleDateString('en-IN')}</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-200 mt-0.5">
                        Expiry: {new Date(doc.endDate).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs">
                      {doc.notes ? (
                        <div className="flex items-start gap-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">Doc:</span>
                          <span className="truncate" title={doc.notes}>{doc.notes}</span>
                        </div>
                      ) : null}
                      {doc.customer?.remarks ? (
                        <div className={`flex items-start gap-1 ${doc.notes ? 'mt-1' : ''} text-amber-600 dark:text-amber-400`}>
                          <span className="font-semibold shrink-0">Cust:</span>
                          <span className="truncate" title={doc.customer.remarks}>{doc.customer.remarks}</span>
                        </div>
                      ) : null}
                      {!doc.notes && !doc.customer?.remarks && (
                        <span className="text-slate-400 dark:text-slate-600 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {doc.daysRemaining <= 30 ? (
                        <button
                          onClick={() => openRenewalModal(doc)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105"
                        >
                          Renew Now
                        </button>
                      ) : (
                        <button
                          onClick={() => openRenewalModal(doc)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105"
                          title="Pre-Renew early (> 30 days remaining)"
                        >
                          Pre-Renew
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Renewal Modal */}
      {renewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-card max-w-md w-full p-6 space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Renew {renewingDoc.documentName}
              </h3>
              <button
                onClick={() => setRenewingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p className="font-semibold text-slate-900 dark:text-white">
                {renewingDoc.customer.firstName} {renewingDoc.customer.secondName}
              </p>
              <p className="font-mono text-xs text-slate-500 mt-0.5">
                Vehicle: {renewingDoc.customer.vehicleNumber}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Current Expiry: {new Date(renewingDoc.endDate).toLocaleDateString('en-IN')}
              </p>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  New Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  New Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewingDoc(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRenewal}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-60"
                >
                  {isSubmittingRenewal ? 'Processing Renewal...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Export Documents Modal */}
      <ExportDocumentsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
