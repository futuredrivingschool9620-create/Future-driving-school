import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { customerApi, documentApi } from '../../lib/api';
import type { Customer, DocumentWithStatus } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Renewal Modal State
  const [renewingDoc, setRenewingDoc] = useState<DocumentWithStatus | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await customerApi.getById(id);
      setCustomer(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load customer details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleConfirmDelete = async () => {
    if (!id || !customer) return;
    setIsDeletingCustomer(true);
    setDeleteError('');
    try {
      await customerApi.delete(id);
      navigate('/customers', { state: { message: `Customer "${customer.fullName}" deleted successfully.` } });
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      setDeleteError(err?.response?.data?.error || 'Failed to delete customer. Please try again.');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const openRenewalModal = (doc: DocumentWithStatus) => {
    setRenewingDoc(doc);
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setNewStartDate(today);
    setNewEndDate(nextYear.toISOString().split('T')[0]);
    setRenewalNotes('');
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingDoc) return;
    try {
      setIsSubmittingRenewal(true);
      const isPreRenewal = renewingDoc.daysRemaining > 30;
      await documentApi.renew(renewingDoc.id, {
        newStartDate,
        newEndDate,
        notes: renewalNotes || undefined,
        renewalType: isPreRenewal ? 'PRE_RENEWAL' : 'NORMAL',
      });
      setRenewingDoc(null);
      fetchCustomer();
    } catch (err) {
      console.error(err);
      alert('Failed to renew document. Please check dates.');
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Customer Not Found</h2>
        <p className="text-slate-500 mb-6">{error || 'The requested customer does not exist or has been deleted.'}</p>
        <Link to="/customers" className="text-indigo-600 font-medium hover:underline">
          &larr; Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/customers"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white text-2xl font-bold">
                {customer.firstName.charAt(0)}{(customer.secondName || '').charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{customer.fullName}</h1>
              <p className="text-sm mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                <span>Joined {new Date(customer.createdAt).toLocaleDateString()}</span>
                <span>&bull;</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {customer.vehicleNumber}
                </span>
                {customer.vehicleType && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {customer.vehicleType}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            to={`/customers/${customer.id}/edit`}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Edit Customer
          </Link>
          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setShowDeleteModal(true);
            }}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold transition-colors border border-red-200 dark:border-red-800/50 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Contact Information</h3>
            <div className="space-y-4">
              {customer.secondName && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Reference Name</p>
                  <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {customer.secondName}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Phone Number</p>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {customer.phoneNumber}
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 mb-1">Vehicle Details</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <p className="font-mono text-base font-bold text-slate-800 dark:text-slate-200">
                      {customer.vehicleNumber}
                    </p>
                  </div>
                  {customer.vehicleType && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                      {customer.vehicleType}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {customer.remarks && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 mb-2">Remarks</p>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {customer.remarks}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Quick Actions</h3>
            <div className="space-y-3">
              <Link to={`/notifications?customerId=${customer.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">View Notifications</p>
                  <p className="text-xs text-slate-500">History for this customer</p>
                </div>
              </Link>
              <Link to={`/renewals?customerId=${customer.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">View Renewal History</p>
                  <p className="text-xs text-slate-500">Past document renewals</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Documents */}
        <div className="lg:col-span-2">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Current Documents</h3>
              <Link
                to={`/customers/${customer.id}/edit`}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Document
              </Link>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {!customer.allDocuments?.filter(d => d.isCurrent).length ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 mb-2">No active documents found.</p>
                </div>
              ) : (
                customer.allDocuments.filter(d => d.isCurrent).map(doc => (
                  <div key={doc.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                            {doc.documentName}
                            {doc.renewalVersion > 1 && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                v{doc.renewalVersion}
                              </span>
                            )}
                          </h4>
                          <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{new Date(doc.startDate).toLocaleDateString()}</span>
                            <span>&rarr;</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(doc.endDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} />
                    </div>
                    
                    {doc.notes && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">Note:</span>
                        <span className="whitespace-pre-wrap">{doc.notes}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-xs text-slate-500">
                        {doc.daysRemaining > 0 ? `${doc.daysRemaining} days remaining` : 'Expired'}
                      </div>
                      {doc.daysRemaining <= 30 ? (
                        <button
                          onClick={() => openRenewalModal(doc)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105"
                        >
                          Renew Now
                        </button>
                      ) : (
                        <button
                          onClick={() => openRenewalModal(doc)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105"
                          title="Pre-Renew early (> 30 days remaining)"
                        >
                          Pre-Renew
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Renewal Modal */}
      {renewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-card max-w-md w-full p-6 space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {renewingDoc.daysRemaining > 30 ? 'Pre-Renew' : 'Renew'} {renewingDoc.documentName}
              </h3>
              <button
                onClick={() => setRenewingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                Customer: {customer.fullName}
              </p>
              <p className="font-mono text-xs text-slate-500">
                Vehicle: {customer.vehicleNumber}
              </p>
              <p className="text-xs text-slate-500">
                Current Expiry: {new Date(renewingDoc.endDate).toLocaleDateString()} ({renewingDoc.daysRemaining} days remaining)
              </p>
              {renewingDoc.daysRemaining > 30 && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                  ⚡ <strong>Pre-Renewal Mode:</strong> You are renewing this document early (&gt;30 days remaining).
                </div>
              )}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notes / Audit Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Early payment received"
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
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
                  className={`px-5 py-2 text-white rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-60 ${
                    renewingDoc.daysRemaining > 30
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmittingRenewal
                    ? 'Processing...'
                    : renewingDoc.daysRemaining > 30
                    ? 'Confirm Pre-Renewal'
                    : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Customer</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{customer.fullName}"</span>?
              </p>
              <p className="text-xs text-rose-500 font-medium">
                This will deactivate the customer and all associated documents.
              </p>
              {deleteError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError('');
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingCustomer ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Customer</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
