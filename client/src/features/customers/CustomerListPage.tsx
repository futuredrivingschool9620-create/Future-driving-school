import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { customerApi } from '../../lib/api';
import type { Customer, DocumentWithStatus } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';

export default function CustomerListPage() {
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, document.title);
      const t = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(t);
    }
  }, [location.state]);

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = searchQuery
        ? await customerApi.search(searchQuery, page)
        : await customerApi.getAll(page);

      setCustomers(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    const { id, name } = customerToDelete;
    setIsDeleting(true);
    try {
      // Optimistically remove from current list
      setCustomers(prev => prev.filter(c => c.id !== id));
      setTotalItems(prev => Math.max(0, prev - 1));
      await customerApi.delete(id);
      setSuccessMessage(`Customer "${name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(''), 4000);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      setErrorMessage(error?.response?.data?.error || 'Failed to delete customer. Please try again.');
      setTimeout(() => setErrorMessage(''), 4000);
      setCustomerToDelete(null);
      fetchCustomers();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Feedback */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Customers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Manage your {totalItems} registered customers and their vehicles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/customers/new?mode=pdf"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Uploaded PDF
          </Link>
          <Link
            to="/customers/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Customer
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, phone, or vehicle number..."
            className="block w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm"
            style={{ color: 'var(--color-text-primary)' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            className="absolute inset-y-1.5 right-1.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Customer List */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white/50 dark:bg-slate-900/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-500">Loading customers...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                    <p className="text-slate-900 dark:text-white font-medium text-lg">No customers found</p>
                    <p className="text-slate-500 mt-1">Try adjusting your search or add a new customer.</p>
                  </td>
                </tr>
              ) : (
                customers.map((customer: Customer) => {
                  const isSameName = customers.some(
                    (other) =>
                      other.id !== customer.id &&
                      ((customer.firstName && other.firstName && customer.firstName.trim().toLowerCase() === other.firstName.trim().toLowerCase() &&
                        (customer.secondName || '').trim().toLowerCase() === (other.secondName || '').trim().toLowerCase()) ||
                       (customer.fullName && other.fullName && customer.fullName.trim().toLowerCase() === other.fullName.trim().toLowerCase()))
                  );

                  return (
                    <tr key={customer.id} className={`transition-colors ${
                      isSameName ? 'bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/40' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/80'
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSameName
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm'
                              : 'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            <span className="font-bold text-sm">
                              {customer.firstName.charAt(0)}{(customer.secondName || '').charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {customer.fullName || [customer.firstName, customer.secondName].filter(Boolean).join(' ') || customer.firstName}
                              </div>
                              {isSameName && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                  Same Name
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Added {new Date(customer.createdAt).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm inline-flex items-center gap-1.5 ${
                          isSameName
                            ? 'px-2.5 py-1 rounded-lg bg-amber-100/90 dark:bg-amber-950/80 border-2 border-amber-500 text-amber-900 dark:text-amber-200 font-mono font-bold shadow-xs'
                            : 'text-slate-900 dark:text-slate-300'
                        }`}>
                          <span>{customer.phoneNumber}</span>
                          {isSameName && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white tracking-normal">
                              Primary Key
                            </span>
                          )}
                        </div>
                      </td>
                    <td className="px-6 py-4">
                      {customer.vehicles && customer.vehicles.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {customer.vehicles.map((v) => (
                            <div key={v.id} className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                {v.vehicleNumber}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {v.vehicleType}
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                v.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                  : v.status === 'Expired'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                              }`}>
                                {v.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {customer.vehicleNumber || 'No vehicle'}
                          </div>
                          {customer.vehicleType && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                              {customer.vehicleType}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {customer.vehicles && customer.vehicles.length > 0 ? (
                          customer.vehicles.flatMap((v) =>
                            v.documents ? v.documents.filter((d) => d.isCurrent).map((doc) => ({ ...doc, vehicleNumber: v.vehicleNumber })) : []
                          ).slice(0, 6).map((doc) => (
                            <div
                              key={doc.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
                              title={`${doc.documentName} for ${doc.vehicleNumber}`}
                            >
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{doc.documentName}:</span>
                              <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} compact />
                            </div>
                          ))
                        ) : customer.currentDocuments && Object.values(customer.currentDocuments).length > 0 ? (
                          Object.values(customer.currentDocuments).map((doc: DocumentWithStatus) => (
                            <div
                              key={doc.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.documentName}:</span>
                              <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} compact />
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No active documents</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          View
                        </Link>
                        <Link
                          to={`/customers/${customer.id}/edit`}
                          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setCustomerToDelete({
                            id: customer.id,
                            name: customer.fullName || `${customer.firstName} ${customer.secondName || ''}`.trim(),
                          })}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Showing page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In-App Delete Confirmation Modal */}
      {customerToDelete && (
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
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{customerToDelete.name}"</span>?
              </p>
              <p className="text-xs text-rose-500 font-medium">
                This will deactivate the customer and all associated documents.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
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
