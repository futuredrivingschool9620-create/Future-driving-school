import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { customerApi, documentApi, vehicleApi } from '../../lib/api';
import type { Customer, DocumentWithStatus, Vehicle } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';
import { validateAndFormatVehicleNumber } from '../../lib/vehicleValidation';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected vehicle tab
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Renewal Modal State
  const [renewingDoc, setRenewingDoc] = useState<DocumentWithStatus | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);

  // Customer Delete Modal State
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState('');

  // Vehicle Delete Modal State
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [deleteVehicleError, setDeleteVehicleError] = useState('');

  // Add Vehicle Modal State
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [addVehicleError, setAddVehicleError] = useState('');
  const [newVehicleType, setNewVehicleType] = useState<'2 Wheeler' | '4 Wheeler' | 'Truck'>('4 Wheeler');
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [newVehicleStatus, setNewVehicleStatus] = useState<'Active' | 'Expired' | 'Renewed'>('Active');
  const [newVehicleNotes, setNewVehicleNotes] = useState('');
  const [newInsStart, setNewInsStart] = useState('');
  const [newInsEnd, setNewInsEnd] = useState('');
  const [newFcStart, setNewFcStart] = useState('');
  const [newFcEnd, setNewFcEnd] = useState('');
  const [newTaxStart, setNewTaxStart] = useState('');
  const [newTaxEnd, setNewTaxEnd] = useState('');

  // Edit Vehicle Modal State
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editVehicleNumber, setEditVehicleNumber] = useState('');
  const [editVehicleType, setEditVehicleType] = useState<'2 Wheeler' | '4 Wheeler' | 'Truck'>('4 Wheeler');
  const [editVehicleStatus, setEditVehicleStatus] = useState<'Active' | 'Expired' | 'Renewed'>('Active');
  const [editVehicleNotes, setEditVehicleNotes] = useState('');
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  const [editVehicleError, setEditVehicleError] = useState('');

  // Add Document to Vehicle Modal State
  const [addingDocVehicle, setAddingDocVehicle] = useState<Vehicle | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [newDocStart, setNewDocStart] = useState('');
  const [newDocEnd, setNewDocEnd] = useState('');
  const [newDocNotes, setNewDocNotes] = useState('');
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [addDocError, setAddDocError] = useState('');

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await customerApi.getById(id);
      setCustomer(data);
      if (data.vehicles && data.vehicles.length > 0) {
        // Default to first vehicle or keep existing selection if valid
        setSelectedVehicleId((prev) => {
          if (prev && data.vehicles?.some((v) => v.id === prev)) return prev;
          return data.vehicles![0].id;
        });
      }
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

  // Selected vehicle object
  const activeVehicle =
    customer?.vehicles?.find((v) => v.id === selectedVehicleId) ||
    customer?.vehicles?.[0] ||
    null;

  // Handle Delete Customer
  const handleConfirmDeleteCustomer = async () => {
    if (!id || !customer) return;
    setIsDeletingCustomer(true);
    setDeleteCustomerError('');
    try {
      await customerApi.delete(id);
      navigate('/customers', { state: { message: `Customer "${customer.fullName}" deleted successfully.` } });
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      setDeleteCustomerError(err?.response?.data?.error || 'Failed to delete customer.');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  // Handle Delete Single Vehicle
  const handleConfirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setIsDeletingVehicle(true);
    setDeleteVehicleError('');
    try {
      await vehicleApi.delete(vehicleToDelete.id);
      setVehicleToDelete(null);
      await fetchCustomer();
    } catch (err: any) {
      console.error('Failed to delete vehicle:', err);
      setDeleteVehicleError(err?.response?.data?.error || 'Failed to delete vehicle.');
    } finally {
      setIsDeletingVehicle(false);
    }
  };

  // Handle Add Vehicle Submit
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const vResult = validateAndFormatVehicleNumber(newVehicleNumber);
    if (!vResult.valid) {
      setAddVehicleError(vResult.error || 'Invalid Indian vehicle registration number');
      return;
    }

    try {
      setIsAddingVehicle(true);
      setAddVehicleError('');

      await vehicleApi.create(customer.id, {
        vehicleType: newVehicleType,
        vehicleNumber: vResult.formatted || newVehicleNumber.trim().toUpperCase(),
        status: newVehicleStatus,
        notes: newVehicleNotes.trim() || undefined,
        insurance: newInsStart && newInsEnd ? { startDate: newInsStart, endDate: newInsEnd } : undefined,
        fc: newFcStart && newFcEnd ? { startDate: newFcStart, endDate: newFcEnd } : undefined,
        tax: newTaxStart && newTaxEnd ? { startDate: newTaxStart, endDate: newTaxEnd } : undefined,
      });

      setShowAddVehicleModal(false);
      // Reset form
      setNewVehicleNumber('');
      setNewVehicleNotes('');
      setNewInsStart('');
      setNewInsEnd('');
      setNewFcStart('');
      setNewFcEnd('');
      setNewTaxStart('');
      setNewTaxEnd('');

      await fetchCustomer();
    } catch (err: any) {
      console.error('Failed to add vehicle:', err);
      setAddVehicleError(err?.response?.data?.error || 'Failed to add vehicle.');
    } finally {
      setIsAddingVehicle(false);
    }
  };

  // Handle Edit Vehicle Submit
  const handleEditVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    const vResult = validateAndFormatVehicleNumber(editVehicleNumber);
    if (!vResult.valid) {
      setEditVehicleError(vResult.error || 'Invalid vehicle number');
      return;
    }

    try {
      setIsUpdatingVehicle(true);
      setEditVehicleError('');

      await vehicleApi.update(editingVehicle.id, {
        vehicleType: editVehicleType,
        vehicleNumber: vResult.formatted || editVehicleNumber.trim().toUpperCase(),
        status: editVehicleStatus,
        notes: editVehicleNotes.trim() || undefined,
      });

      setEditingVehicle(null);
      await fetchCustomer();
    } catch (err: any) {
      console.error('Failed to update vehicle:', err);
      setEditVehicleError(err?.response?.data?.error || 'Failed to update vehicle.');
    } finally {
      setIsUpdatingVehicle(false);
    }
  };

  // Handle Quick Vehicle Status Change
  const handleQuickStatusChange = async (vehicleId: string, status: 'Active' | 'Expired' | 'Renewed') => {
    try {
      await vehicleApi.updateStatus(vehicleId, { status });
      await fetchCustomer();
    } catch (err) {
      console.error('Failed to update vehicle status:', err);
    }
  };

  // Handle Add Document to Vehicle
  const handleAddDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingDocVehicle || !newDocName.trim() || !newDocStart || !newDocEnd) return;

    try {
      setIsAddingDoc(true);
      setAddDocError('');

      await vehicleApi.addDocument(addingDocVehicle.id, {
        documentName: newDocName.trim(),
        startDate: newDocStart,
        endDate: newDocEnd,
        notes: newDocNotes.trim() || undefined,
      });

      setAddingDocVehicle(null);
      setNewDocName('');
      setNewDocStart('');
      setNewDocEnd('');
      setNewDocNotes('');
      await fetchCustomer();
    } catch (err: any) {
      console.error('Failed to add document:', err);
      setAddDocError(err?.response?.data?.error || 'Failed to add document.');
    } finally {
      setIsAddingDoc(false);
    }
  };

  // Open Document Renewal Modal
  const openRenewalModal = (doc: DocumentWithStatus) => {
    setRenewingDoc(doc);
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setNewStartDate(today);
    setNewEndDate(nextYear.toISOString().split('T')[0]);
    setRenewalNotes('');
  };

  // Handle Document Renewal Submit
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
      await fetchCustomer();
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
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading customer & vehicles...</p>
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

  const vehiclesList = customer.vehicles || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white text-xl font-bold">
              {customer.firstName.charAt(0)}{(customer.secondName || '').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {customer.fullName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {vehiclesList.length} {vehiclesList.length === 1 ? 'Vehicle' : 'Vehicles'}
                </span>
              </div>
              <p className="text-xs mt-1 text-slate-500 flex items-center gap-2">
                <span>Joined {new Date(customer.createdAt).toLocaleDateString('en-IN')}</span>
                <span>&bull;</span>
                <span>{customer.phoneNumber}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAddVehicleError('');
              setShowAddVehicleModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Vehicle
          </button>

          <Link
            to={`/customers/${customer.id}/edit`}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Edit
          </Link>

          <button
            type="button"
            onClick={() => {
              setDeleteCustomerError('');
              setShowDeleteCustomerModal(true);
            }}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold transition-colors border border-red-200 dark:border-red-900/50 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Details */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-800">
              Customer Details
            </h3>
            {customer.secondName && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Reference Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{customer.secondName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Phone Number</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{customer.phoneNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Total Registered Vehicles</p>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {vehiclesList.length} {vehiclesList.length === 1 ? 'Vehicle' : 'Vehicles'}
              </p>
            </div>
            {customer.remarks && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1.5">Remarks</p>
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {customer.remarks}
                </div>
              </div>
            )}
          </div>

          {/* Quick Navigation Links */}
          <div className="glass-card p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
              Customer Audit Trail
            </h3>
            <Link
              to={`/notifications?customerId=${customer.id}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">
                  Notification History
                </p>
                <p className="text-[11px] text-slate-500">Reminder SMS & WhatsApp log</p>
              </div>
            </Link>

            <Link
              to={`/renewals?customerId=${customer.id}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">
                  Renewal History
                </p>
                <p className="text-[11px] text-slate-500">Document renewal audit trail</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Right Column: Vehicles & Documents Management */}
        <div className="space-y-6 lg:col-span-2">
          {/* Vehicle Navigation Selector Tabs */}
          {vehiclesList.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {vehiclesList.map((v, idx) => {
                const isSelected = v.id === activeVehicle?.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span>#{idx + 1}</span>
                    <span className="font-mono">{v.vehicleNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {v.vehicleType}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      v.status === 'Active'
                        ? 'bg-emerald-400'
                        : v.status === 'Expired'
                        ? 'bg-rose-400'
                        : 'bg-indigo-400'
                    }`} />
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setAddVehicleError('');
                  setShowAddVehicleModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shrink-0 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                + Add Vehicle
              </button>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-slate-500 mb-4">No vehicles registered for this customer yet.</p>
              <button
                type="button"
                onClick={() => {
                  setAddVehicleError('');
                  setShowAddVehicleModal(true);
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                + Add First Vehicle
              </button>
            </div>
          )}

          {/* Active Vehicle Card Details */}
          {activeVehicle && (
            <div className="glass-card overflow-hidden space-y-6 p-6 sm:p-7">
              {/* Vehicle Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xl font-black text-slate-900 dark:text-white">
                      {activeVehicle.vehicleNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {activeVehicle.vehicleType}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      activeVehicle.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : activeVehicle.status === 'Expired'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                    }`}>
                      {activeVehicle.status}
                    </span>
                  </div>
                  {activeVehicle.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">{activeVehicle.notes}</p>
                  )}
                </div>

                {/* Per-Vehicle Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Switcher */}
                  <select
                    value={activeVehicle.status}
                    onChange={(e) => handleQuickStatusChange(activeVehicle.id, e.target.value as any)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Active">Status: Active</option>
                    <option value="Expired">Status: Expired</option>
                    <option value="Renewed">Status: Renewed</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setAddingDocVehicle(activeVehicle);
                      setAddDocError('');
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors cursor-pointer"
                  >
                    + Add Doc
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingVehicle(activeVehicle);
                      setEditVehicleNumber(activeVehicle.vehicleNumber);
                      setEditVehicleType(activeVehicle.vehicleType as any);
                      setEditVehicleStatus(activeVehicle.status as any);
                      setEditVehicleNotes(activeVehicle.notes || '');
                      setEditVehicleError('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVehicleToDelete(activeVehicle);
                      setDeleteVehicleError('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl transition-colors border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                  >
                    Delete Vehicle
                  </button>
                </div>
              </div>

              {/* Documents for this Vehicle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Current Documents ({activeVehicle.documents?.filter((d) => d.isCurrent).length || 0})
                  </h4>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {!activeVehicle.documents || activeVehicle.documents.filter((d) => d.isCurrent).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No documents registered for vehicle {activeVehicle.vehicleNumber}. Use &ldquo;+ Add Doc&rdquo; above.
                    </div>
                  ) : (
                    activeVehicle.documents
                      .filter((d) => d.isCurrent)
                      .map((doc) => (
                        <div key={doc.id} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {doc.documentName}
                              </span>
                              {doc.renewalVersion > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                  v{doc.renewalVersion}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <span>Valid: {new Date(doc.startDate).toLocaleDateString('en-IN')}</span>
                              <span>&rarr;</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {new Date(doc.endDate).toLocaleDateString('en-IN')}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} />
                            <button
                              type="button"
                              onClick={() => openRenewalModal(doc)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
                            >
                              Renew
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Renewal History for this vehicle */}
              {activeVehicle.renewalHistories && activeVehicle.renewalHistories.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Vehicle Renewal History ({activeVehicle.renewalHistories.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-left divide-y divide-slate-100 dark:divide-slate-800">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="py-2">Document</th>
                          <th className="py-2">Previous Validity</th>
                          <th className="py-2">New Validity</th>
                          <th className="py-2">Renewed On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {activeVehicle.renewalHistories.map((rh) => (
                          <tr key={rh.id}>
                            <td className="py-2 font-semibold">{rh.oldDocumentName}</td>
                            <td className="py-2 line-through text-red-400">
                              {new Date(rh.oldEndDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                              {new Date(rh.newEndDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2 text-slate-500">
                              {new Date(rh.renewalDate).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Another Vehicle to {customer.fullName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registers an additional vehicle linked to this customer profile without creating duplicate records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {addVehicleError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-600 text-xs font-semibold">
                {addVehicleError}
              </div>
            )}

            <form onSubmit={handleAddVehicleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={newVehicleNumber}
                    onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="KA 01 AB 1234"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Vehicle Type *
                  </label>
                  <select
                    value={newVehicleType}
                    onChange={(e) => setNewVehicleType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  >
                    <option value="2 Wheeler">2 Wheeler (Bike / Scooter)</option>
                    <option value="4 Wheeler">4 Wheeler (Car / SUV)</option>
                    <option value="Truck">Truck (Commercial)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Vehicle Status
                </label>
                <div className="flex gap-2">
                  {(['Active', 'Expired', 'Renewed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNewVehicleStatus(st)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        newVehicleStatus === st
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard Documents */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <p className="text-xs font-bold uppercase text-slate-500">Standard Documents (Optional)</p>
                
                {/* Insurance */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="col-span-2 text-xs font-bold text-slate-800 dark:text-slate-200">Insurance Dates</div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newInsStart}
                      onChange={(e) => setNewInsStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newInsEnd}
                      onChange={(e) => setNewInsEnd(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* FC */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="col-span-2 text-xs font-bold text-slate-800 dark:text-slate-200">Fitness (FC) Dates</div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newFcStart}
                      onChange={(e) => setNewFcStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newFcEnd}
                      onChange={(e) => setNewFcEnd(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Tax */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="col-span-2 text-xs font-bold text-slate-800 dark:text-slate-200">Road Tax Dates</div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newTaxStart}
                      onChange={(e) => setNewTaxStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newTaxEnd}
                      onChange={(e) => setNewTaxEnd(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Vehicle Notes (Optional)</label>
                <input
                  type="text"
                  value={newVehicleNotes}
                  onChange={(e) => setNewVehicleNotes(e.target.value)}
                  placeholder="e.g. Primary delivery van"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingVehicle}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isAddingVehicle ? 'Adding Vehicle...' : 'Confirm & Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Vehicle</h3>
              <button
                type="button"
                onClick={() => setEditingVehicle(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            {editVehicleError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">{editVehicleError}</div>
            )}

            <form onSubmit={handleEditVehicleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  required
                  value={editVehicleNumber}
                  onChange={(e) => setEditVehicleNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Type *
                </label>
                <select
                  value={editVehicleType}
                  onChange={(e) => setEditVehicleType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="2 Wheeler">2 Wheeler</option>
                  <option value="4 Wheeler">4 Wheeler</option>
                  <option value="Truck">Truck</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Status
                </label>
                <select
                  value={editVehicleStatus}
                  onChange={(e) => setEditVehicleStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Renewed">Renewed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={editVehicleNotes}
                  onChange={(e) => setEditVehicleNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingVehicle}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {isUpdatingVehicle ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Document to Vehicle Modal */}
      {addingDocVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Document to {addingDocVehicle.vehicleNumber}
              </h3>
              <button
                type="button"
                onClick={() => setAddingDocVehicle(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            {addDocError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">{addDocError}</div>
            )}

            <form onSubmit={handleAddDocSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Document Name *
                </label>
                <input
                  type="text"
                  required
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="e.g. Emission Certificate / Permit / Road Tax"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newDocStart}
                    onChange={(e) => setNewDocStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newDocEnd}
                    onChange={(e) => setNewDocEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newDocNotes}
                  onChange={(e) => setNewDocNotes(e.target.value)}
                  placeholder="Certificate number or notes"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddingDocVehicle(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingDoc}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {isAddingDoc ? 'Adding...' : 'Add Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vehicle Confirmation Modal */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Vehicle</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete vehicle <span className="font-mono font-bold text-slate-900 dark:text-white">{vehicleToDelete.vehicleNumber}</span>?
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Only this vehicle and its documents will be removed. The customer and all other vehicles will remain completely active!
              </p>
              {deleteVehicleError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                  {deleteVehicleError}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                disabled={isDeletingVehicle}
                onClick={() => setVehicleToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingVehicle}
                onClick={handleConfirmDeleteVehicle}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {isDeletingVehicle ? 'Deleting Vehicle...' : 'Delete Vehicle Only'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Modal */}
      {showDeleteCustomerModal && customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Customer Profile</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{customer.fullName}"</span>?
              </p>
              <p className="text-xs text-rose-500 font-medium">
                This will deactivate the customer and all {vehiclesList.length} associated vehicle(s).
              </p>
              {deleteCustomerError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                  {deleteCustomerError}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={() => setShowDeleteCustomerModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={handleConfirmDeleteCustomer}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {isDeletingCustomer ? 'Deleting...' : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Renewal Modal */}
      {renewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Renew {renewingDoc.documentName}
                </h3>
                <p className="text-xs text-slate-500">
                  Current Expiry: {new Date(renewingDoc.endDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenewingDoc(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Start Date</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Renewal Notes (Optional)</label>
                <input
                  type="text"
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  placeholder="Policy number or reference"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRenewingDoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRenewal}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {isSubmittingRenewal ? 'Renewing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
