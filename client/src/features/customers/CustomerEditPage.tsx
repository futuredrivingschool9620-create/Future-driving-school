import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customerApi, documentApi } from '../../lib/api';
import { validateAndFormatVehicleNumber } from '../../lib/vehicleValidation';
import { validatePhoneNumber, sanitizePhoneInput } from '../../lib/phoneValidation';

export default function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Customer basic info
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [vehicleType, setVehicleType] = useState<'2 Wheeler' | '4 Wheeler' | 'Truck'>('4 Wheeler');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [remarks, setRemarks] = useState('');

  // New document (optional addition during edit)
  const [newDocName, setNewDocName] = useState('');
  const [newDocStart, setNewDocStart] = useState('');
  const [newDocEnd, setNewDocEnd] = useState('');
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await customerApi.getById(id);
      setFirstName(data.firstName);
      setSecondName(data.secondName || '');
      if (data.vehicleType === '2 Wheeler' || data.vehicleType === '4 Wheeler' || data.vehicleType === 'Truck') {
        setVehicleType(data.vehicleType);
      }
      setPhoneNumber(data.phoneNumber);
      setVehicleNumber(data.vehicleNumber || data.vehicles?.[0]?.vehicleNumber || '');
      setRemarks(data.remarks || '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setError('');
    setIsSubmitting(true);

    const pResult = validatePhoneNumber(phoneNumber);
    if (!pResult.valid) {
      setPhoneError(pResult.error || 'Invalid mobile number');
      setError(pResult.error || 'Invalid mobile number');
      setIsSubmitting(false);
      return;
    }
    setPhoneError('');

    const vResult = validateAndFormatVehicleNumber(vehicleNumber);
    if (!vResult.valid) {
      setVehicleError(vResult.error || 'Invalid vehicle number');
      setError(vResult.error || 'Invalid vehicle number');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Update customer details
      await customerApi.update(id, {
        firstName: firstName.trim(),
        secondName: secondName.trim() || undefined,
        vehicleType,
        phoneNumber: pResult.clean || phoneNumber.trim(),
        vehicleNumber: vResult.formatted || vehicleNumber.trim().toUpperCase(),
        remarks: remarks.trim() || undefined,
      });

      // 2. Add new document if provided
      if (isAddingDoc && newDocName.trim() && newDocStart && newDocEnd) {
        await documentApi.create(id, {
          documentName: newDocName.trim(),
          startDate: newDocStart,
          endDate: newDocEnd,
        });
      }

      navigate(`/customers/${id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={`/customers/${id}`}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Edit Customer</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reference Name (Optional)</label>
              <input
                type="text"
                value={secondName}
                onChange={e => setSecondName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500"
                placeholder="Referred by (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Phone Number *</label>
              <input
                type="tel"
                required
                maxLength={10}
                value={phoneNumber}
                onChange={e => {
                  const sanitized = sanitizePhoneInput(e.target.value);
                  setPhoneNumber(sanitized);
                  if (phoneError) setPhoneError('');
                }}
                onBlur={() => {
                  if (phoneNumber.trim()) {
                    const res = validatePhoneNumber(phoneNumber);
                    if (!res.valid) {
                      setPhoneError(res.error || 'Invalid mobile number');
                    } else {
                      setPhoneError('');
                    }
                  }
                }}
                className={`w-full px-4 py-3 rounded-xl border ${
                  phoneError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700'
                } bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 font-mono`}
              />
              {phoneError ? (
                <p className="mt-1.5 text-xs text-rose-500 font-medium">{phoneError}</p>
              ) : phoneNumber.length === 10 && /^[6-9]/.test(phoneNumber) ? (
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  Valid 10-digit Indian mobile number
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">10-digit Indian mobile number (starts with 6-9)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Vehicle Number *</label>
              <input
                type="text"
                required
                value={vehicleNumber}
                onChange={e => {
                  setVehicleNumber(e.target.value.toUpperCase());
                  if (vehicleError) setVehicleError('');
                }}
                onBlur={() => {
                  if (vehicleNumber.trim()) {
                    const res = validateAndFormatVehicleNumber(vehicleNumber);
                    if (res.valid && res.formatted) {
                      setVehicleNumber(res.formatted);
                      setVehicleError('');
                    } else {
                      setVehicleError(res.error || '');
                    }
                  }
                }}
                className={`w-full px-4 py-3 rounded-xl border ${vehicleError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 uppercase font-mono`}
                placeholder="KA 01 AB 1234"
              />
              {vehicleError && (
                <p className="mt-1.5 text-xs text-rose-500 font-medium">{vehicleError}</p>
              )}
            </div>
          </div>

          {/* Vehicle Type Selection */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">
              Vehicle Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  type: '2 Wheeler' as const,
                  label: '2 Wheeler',
                  desc: 'Bike / Scooter',
                  icon: (
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-12-4h4.5l3-6h4.5M10.5 14l1.5-3" />
                    </svg>
                  ),
                },
                {
                  type: '4 Wheeler' as const,
                  label: '4 Wheeler',
                  desc: 'Car / Van / SUV',
                  icon: (
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h7.5m-7.5 0H4.5A2.25 2.25 0 0 1 2.25 16.5V9.75A2.25 2.25 0 0 1 4.5 7.5h1.879a2.25 2.25 0 0 1 1.591.659l2.121 2.121H18a2.25 2.25 0 0 1 2.25 2.25V16.5a2.25 2.25 0 0 1-2.25 2.25h-1.5m-3 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0" />
                    </svg>
                  ),
                },
                {
                  type: 'Truck' as const,
                  label: 'Truck',
                  desc: 'Heavy Commercial',
                  icon: (
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375A1.125 1.125 0 0 1 2.25 17.625V5.625A1.125 1.125 0 0 1 3.375 4.5h11.25c.621 0 1.125.504 1.125 1.125v4.875h3.375c.621 0 1.125.504 1.125 1.125v6a1.125 1.125 0 0 1-1.125 1.125h-1.5m-3 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0" />
                    </svg>
                  ),
                },
              ].map(opt => {
                const selected = vehicleType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setVehicleType(opt.type)}
                    className={`relative p-3.5 sm:p-4 rounded-xl border text-left transition-all duration-200 flex flex-col items-start gap-2 ${
                      selected
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30 text-indigo-900 dark:text-indigo-100 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}>
                        {opt.icon}
                      </div>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selected
                          ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Remarks (Optional)</label>
            <textarea
              maxLength={500}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors resize-none"
              placeholder="Add any specific notes or remarks about this customer (max 500 characters)..."
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {remarks.length}/500
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Add New Document</h2>
            <button
              type="button"
              onClick={() => setIsAddingDoc(!isAddingDoc)}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
            >
              {isAddingDoc ? 'Cancel' : '+ Add Document'}
            </button>
          </div>

          {isAddingDoc && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Document Name</label>
                <input
                  type="text"
                  required={isAddingDoc}
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="e.g. Permit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date</label>
                <input
                  type="date"
                  required={isAddingDoc}
                  value={newDocStart}
                  onChange={e => setNewDocStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Expiry Date</label>
                <input
                  type="date"
                  required={isAddingDoc}
                  value={newDocEnd}
                  onChange={e => setNewDocEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Link
            to={`/customers/${id}`}
            className="px-6 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 transition-all disabled:opacity-70"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
