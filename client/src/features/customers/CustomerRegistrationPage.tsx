import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { customerApi } from '../../lib/api';
import { validateAndFormatVehicleNumber } from '../../lib/vehicleValidation';
import { validatePhoneNumber, sanitizePhoneInput } from '../../lib/phoneValidation';
import UploadedPdfSection from './UploadedPdfSection';

interface OtherDocItem {
  id: string;
  documentName: string;
  startDate: string;
  endDate: string;
}

interface VehicleFormItem {
  id: string;
  vehicleType: '2 Wheeler' | '4 Wheeler' | 'Truck';
  vehicleNumber: string;
  vehicleError: string;
  status: 'Active' | 'Expired' | 'Renewed';
  notes: string;
  insuranceStart: string;
  insuranceEnd: string;
  fcStart: string;
  fcEnd: string;
  taxStart: string;
  taxEnd: string;
  otherDocuments: OtherDocItem[];
}

function createDefaultVehicle(): VehicleFormItem {
  return {
    id: crypto.randomUUID(),
    vehicleType: '4 Wheeler',
    vehicleNumber: '',
    vehicleError: '',
    status: 'Active',
    notes: '',
    insuranceStart: '',
    insuranceEnd: '',
    fcStart: '',
    fcEnd: '',
    taxStart: '',
    taxEnd: '',
    otherDocuments: [],
  };
}

export default function CustomerRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'pdf' ? 'pdf' : 'manual';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Customer basic info
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [remarks, setRemarks] = useState('');

  // Duplicate customer check
  const [duplicateCustomer, setDuplicateCustomer] = useState<{
    id: string;
    name: string;
    phoneNumber: string;
    vehicles: Array<{ vehicleNumber: string; vehicleType: string }>;
  } | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isPhoneAvailable, setIsPhoneAvailable] = useState(false);

  // Dynamic Vehicles List
  const [vehicles, setVehicles] = useState<VehicleFormItem[]>([createDefaultVehicle()]);

  // Phone number duplicate check in database
  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // If not 10 digits yet, clear states
    if (cleanPhone.length < 10) {
      setDuplicateCustomer(null);
      setIsPhoneAvailable(false);
      setIsCheckingPhone(false);
      return;
    }

    if (cleanPhone.length === 10) {
      const vResult = validatePhoneNumber(cleanPhone);
      if (!vResult.valid) {
        setPhoneError(vResult.error || 'Invalid mobile number');
        setDuplicateCustomer(null);
        setIsPhoneAvailable(false);
        setIsCheckingPhone(false);
        return;
      }

      let isCurrent = true;
      setIsCheckingPhone(true);
      customerApi
        .checkPhone(cleanPhone)
        .then((res) => {
          if (!isCurrent) return;
          if (res.exists && res.customer) {
            setDuplicateCustomer(res.customer);
            setIsPhoneAvailable(false);
            setPhoneError(
              `This number is already registered to ${res.customer.name}. Duplicate numbers are not allowed.`
            );
          } else {
            setDuplicateCustomer(null);
            setIsPhoneAvailable(true);
            setPhoneError('');
          }
        })
        .catch((err) => {
          console.error('Error checking phone duplicate:', err);
          if (isCurrent) {
            setDuplicateCustomer(null);
            setIsPhoneAvailable(false);
          }
        })
        .finally(() => {
          if (isCurrent) setIsCheckingPhone(false);
        });

      return () => {
        isCurrent = false;
      };
    }
  }, [phoneNumber]);

  // Add a new vehicle card
  const addVehicle = () => {
    setVehicles((prev) => [...prev, createDefaultVehicle()]);
  };

  // Remove a vehicle card
  const removeVehicle = (id: string) => {
    if (vehicles.length <= 1) return;
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  // Update vehicle field
  const updateVehicle = <K extends keyof VehicleFormItem>(
    id: string,
    field: K,
    value: VehicleFormItem[K]
  ) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  // Add custom other document to a vehicle
  const addOtherDocToVehicle = (vehicleId: string) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        return {
          ...v,
          otherDocuments: [
            ...v.otherDocuments,
            { id: crypto.randomUUID(), documentName: '', startDate: '', endDate: '' },
          ],
        };
      })
    );
  };

  // Remove custom other document
  const removeOtherDocFromVehicle = (vehicleId: string, docId: string) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        return {
          ...v,
          otherDocuments: v.otherDocuments.filter((d) => d.id !== docId),
        };
      })
    );
  };

  // Update custom other document
  const updateOtherDocInVehicle = (
    vehicleId: string,
    docId: string,
    field: keyof OtherDocItem,
    value: string
  ) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        return {
          ...v,
          otherDocuments: v.otherDocuments.map((d) =>
            d.id === docId ? { ...d, [field]: value } : d
          ),
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone number
    const phoneResult = validatePhoneNumber(phoneNumber);
    if (!phoneResult.valid) {
      setPhoneError(phoneResult.error || 'Invalid mobile number');
      setError(phoneResult.error || 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneError('');

    // Check for duplicate customer
    if (duplicateCustomer) {
      const msg = `Mobile number ${duplicateCustomer.phoneNumber} is already registered to ${duplicateCustomer.name}. Duplicate registrations are not allowed.`;
      setPhoneError(msg);
      setError(msg);
      return;
    }

    // Validate all vehicle numbers
    let hasVehicleError = false;
    const formattedVehicles: any[] = [];

    const updatedVehicles = vehicles.map((v) => {
      const vResult = validateAndFormatVehicleNumber(v.vehicleNumber);
      if (!vResult.valid) {
        hasVehicleError = true;
        return { ...v, vehicleError: vResult.error || 'Invalid vehicle number' };
      }
      return { ...v, vehicleNumber: vResult.formatted || v.vehicleNumber.trim().toUpperCase(), vehicleError: '' };
    });

    setVehicles(updatedVehicles);

    if (hasVehicleError) {
      setError('Please resolve invalid vehicle registration numbers before submitting.');
      return;
    }

    // Check for duplicate vehicle numbers within the form
    const seenNumbers = new Set<string>();
    for (const v of updatedVehicles) {
      const normalized = v.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase();
      if (seenNumbers.has(normalized)) {
        setError(`Duplicate vehicle number "${v.vehicleNumber}" entered in this registration.`);
        return;
      }
      seenNumbers.add(normalized);
    }

    // Prepare payload
    for (const v of updatedVehicles) {
      const otherDocs = v.otherDocuments
        .filter((d) => d.documentName.trim() && d.startDate && d.endDate)
        .map((d) => ({
          documentName: d.documentName.trim(),
          startDate: d.startDate,
          endDate: d.endDate,
        }));

      formattedVehicles.push({
        vehicleType: v.vehicleType,
        vehicleNumber: v.vehicleNumber,
        status: v.status,
        notes: v.notes.trim() || undefined,
        insurance:
          v.insuranceStart && v.insuranceEnd
            ? { startDate: v.insuranceStart, endDate: v.insuranceEnd }
            : undefined,
        fc:
          v.fcStart && v.fcEnd
            ? { startDate: v.fcStart, endDate: v.fcEnd }
            : undefined,
        tax:
          v.taxStart && v.taxEnd
            ? { startDate: v.taxStart, endDate: v.taxEnd }
            : undefined,
        documents: otherDocs.length > 0 ? otherDocs : undefined,
      });
    }

    try {
      setIsSubmitting(true);

      // Verify with server database check to guarantee no duplicates
      const checkRes = await customerApi.checkPhone(phoneResult.clean!);
      if (checkRes.exists && checkRes.customer) {
        setDuplicateCustomer(checkRes.customer);
        const msg = `Mobile number ${checkRes.customer.phoneNumber} is already registered to ${checkRes.customer.name}. Duplicate registrations are not allowed.`;
        setPhoneError(msg);
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      const res = await customerApi.create({
        firstName: firstName.trim(),
        secondName: secondName.trim() || undefined,
        phoneNumber: phoneResult.clean || phoneNumber.trim(),
        remarks: remarks.trim() || undefined,
        vehicles: formattedVehicles,
      });

      navigate(`/customers/${res.id}`);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to register customer';
      setError(errMsg);
      if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('duplicate')) {
        setPhoneError(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/customers"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Customer Registration</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {mode === 'pdf'
                ? 'Upload a single PDF to extract and register multiple customers with duplicate protection.'
                : 'Register a customer and one or more vehicles with separate documents and expiries.'}
            </p>
          </div>
        </div>

        {/* Option Tabs: Manual Registration vs Uploaded PDF */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setSearchParams({ mode: 'manual' })}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'manual'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            Manual Registration
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ mode: 'pdf' })}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'pdf'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Uploaded PDF
          </button>
        </div>
      </div>

      {mode === 'pdf' ? (
        <UploadedPdfSection />
      ) : (
        <>
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3 shadow-xs">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
              </svg>
              <div>
                <p className="font-semibold">Registration Issue</p>
                <p className="mt-0.5 opacity-95">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Customer Profile Details */}
            <div className="glass-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2.5" style={{ color: 'var(--color-text-primary)' }}>
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-xs font-black">1</span>
                  Customer Profile
                </h2>
                {duplicateCustomer ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Duplicate Mobile Number Blocked
                  </span>
                ) : isPhoneAvailable ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Mobile Number Available
                  </span>
                ) : null}
              </div>

              {duplicateCustomer && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50/95 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-rose-800 dark:text-rose-200">
                        Duplicate Mobile Number: {duplicateCustomer.phoneNumber}
                      </p>
                      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                        This mobile number is already registered under <strong>{duplicateCustomer.name}</strong>
                        {duplicateCustomer.vehicles && duplicateCustomer.vehicles.length > 0
                          ? ` (${duplicateCustomer.vehicles.length} vehicle${duplicateCustomer.vehicles.length > 1 ? 's' : ''}: ${duplicateCustomer.vehicles.map((v) => v.vehicleNumber).join(', ')})`
                          : ''}.
                        Duplicate registrations are <strong>not allowed</strong>. Please use another mobile number or view the existing customer.
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/customers/${duplicateCustomer.id}`}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                  >
                    View Existing Profile &rarr;
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phoneNumber}
                      onChange={(e) => {
                        const sanitized = sanitizePhoneInput(e.target.value);
                        setPhoneNumber(sanitized);
                        if (phoneError) setPhoneError('');
                        if (duplicateCustomer) setDuplicateCustomer(null);
                        if (isPhoneAvailable) setIsPhoneAvailable(false);
                      }}
                      onBlur={() => {
                        if (phoneNumber.trim()) {
                          const res = validatePhoneNumber(phoneNumber);
                          if (!res.valid) {
                            setPhoneError(res.error || 'Invalid mobile number');
                          } else if (duplicateCustomer) {
                            setPhoneError(`This number is already registered to ${duplicateCustomer.name}. Duplicate numbers are not allowed.`);
                          } else {
                            setPhoneError('');
                          }
                        }
                      }}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        phoneError || duplicateCustomer
                          ? 'border-rose-500 ring-1 ring-rose-500 text-rose-900 dark:text-rose-100'
                          : isPhoneAvailable
                          ? 'border-emerald-500 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700'
                      } bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors font-mono font-medium`}
                      placeholder="9876543210"
                    />
                    {isCheckingPhone ? (
                      <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    ) : duplicateCustomer ? (
                      <div className="absolute right-3 top-3.5 text-rose-500 font-bold text-sm" title="Duplicate Number Blocked">
                        ✕
                      </div>
                    ) : isPhoneAvailable ? (
                      <div className="absolute right-3 top-3.5 text-emerald-500 font-bold text-sm" title="Number Available">
                        ✓
                      </div>
                    ) : null}
                  </div>
                  {phoneError ? (
                    <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                      <span>⚠️</span> {phoneError}
                    </p>
                  ) : isPhoneAvailable ? (
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span>✓</span> Mobile number is available for new registration
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      10-digit Indian mobile number (starts with 6, 7, 8, 9) {phoneNumber ? `• ${phoneNumber.length}/10` : ''}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="e.g. Ramesh"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Reference Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={secondName}
                    onChange={(e) => setSecondName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Referred by / Reference"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Multiple Vehicles Section */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2.5" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-xs font-black">2</span>
                    Vehicles & Documents
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {vehicles.length} {vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Each vehicle maintains its own separate documents, validity dates, reminders, and renewal history.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addVehicle}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Another Vehicle
                </button>
              </div>

              {/* Vehicle Cards */}
              <div className="space-y-6">
                {vehicles.map((v, index) => (
                  <div
                    key={v.id}
                    className="glass-card p-6 sm:p-7 border-2 border-slate-200/80 dark:border-slate-700/80 rounded-2xl relative shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    {/* Vehicle Header Bar */}
                    <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Vehicle #{index + 1}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {v.vehicleNumber || 'Registration Pending'} &bull; {v.vehicleType}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Toggle */}
                        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                          {(['Active', 'Expired', 'Renewed'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateVehicle(v.id, 'status', st)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                v.status === st
                                  ? st === 'Active'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : st === 'Expired'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>

                        {/* Remove Vehicle Button (Only for index > 0) */}
                        {vehicles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVehicle(v.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                            title="Remove this vehicle"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Number & Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Vehicle Registration Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={v.vehicleNumber}
                          onChange={(e) => {
                            updateVehicle(v.id, 'vehicleNumber', e.target.value.toUpperCase());
                            if (v.vehicleError) updateVehicle(v.id, 'vehicleError', '');
                          }}
                          onBlur={() => {
                            if (v.vehicleNumber.trim()) {
                              const res = validateAndFormatVehicleNumber(v.vehicleNumber);
                              if (res.valid && res.formatted) {
                                updateVehicle(v.id, 'vehicleNumber', res.formatted);
                                updateVehicle(v.id, 'vehicleError', '');
                              } else {
                                updateVehicle(v.id, 'vehicleError', res.error || 'Invalid Indian vehicle number');
                              }
                            }
                          }}
                          className={`w-full px-4 py-3 rounded-xl border ${
                            v.vehicleError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700'
                          } bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-base font-bold uppercase transition-colors`}
                          placeholder="KA 01 AB 1234"
                        />
                        {v.vehicleError ? (
                          <p className="mt-1.5 text-xs text-rose-500 font-medium">{v.vehicleError}</p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-500">e.g. KA 01 AB 1234 or TN 38 BC 5678</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Vehicle Type *
                        </label>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          {[
                            { type: '2 Wheeler' as const, label: '2 Wheeler', desc: 'Bike / Scooter' },
                            { type: '4 Wheeler' as const, label: '4 Wheeler', desc: 'Car / Van / SUV' },
                            { type: 'Truck' as const, label: 'Truck', desc: 'Commercial' },
                          ].map((opt) => {
                            const selected = v.vehicleType === opt.type;
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => updateVehicle(v.id, 'vehicleType', opt.type)}
                                className={`p-3 rounded-xl border text-center transition-all ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 font-bold shadow-xs'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                <p className="text-xs font-bold">{opt.label}</p>
                                <p className="text-[10px] text-slate-500 opacity-90 mt-0.5">{opt.desc}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Standard Documents for this vehicle */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Documents for this vehicle (Separate Validity Dates)
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Insurance */}
                        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">🛡️ Insurance</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">Standard</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={v.insuranceStart}
                                onChange={(e) => updateVehicle(v.id, 'insuranceStart', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Expiry Date</label>
                              <input
                                type="date"
                                value={v.insuranceEnd}
                                onChange={(e) => updateVehicle(v.id, 'insuranceEnd', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* FC (Fitness Certificate) */}
                        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">📋 Fitness (FC)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">Standard</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={v.fcStart}
                                onChange={(e) => updateVehicle(v.id, 'fcStart', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Expiry Date</label>
                              <input
                                type="date"
                                value={v.fcEnd}
                                onChange={(e) => updateVehicle(v.id, 'fcEnd', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Road Tax */}
                        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">💰 Road Tax</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">Standard</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={v.taxStart}
                                onChange={(e) => updateVehicle(v.id, 'taxStart', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Expiry Date</label>
                              <input
                                type="date"
                                value={v.taxEnd}
                                onChange={(e) => updateVehicle(v.id, 'taxEnd', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Custom Other Documents for this vehicle */}
                      <div className="space-y-3 pt-2">
                        {v.otherDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center gap-3"
                          >
                            <div className="w-full sm:w-1/3">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Document Name</label>
                              <input
                                type="text"
                                value={doc.documentName}
                                onChange={(e) => updateOtherDocInVehicle(v.id, doc.id, 'documentName', e.target.value)}
                                placeholder="e.g. Pollution Certificate / Permit"
                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                              />
                            </div>
                            <div className="w-full sm:w-1/4">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={doc.startDate}
                                onChange={(e) => updateOtherDocInVehicle(v.id, doc.id, 'startDate', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div className="w-full sm:w-1/4">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Expiry Date</label>
                              <input
                                type="date"
                                value={doc.endDate}
                                onChange={(e) => updateOtherDocInVehicle(v.id, doc.id, 'endDate', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeOtherDocFromVehicle(v.id, doc.id)}
                              className="mt-4 sm:mt-0 p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Remove this document"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => addOtherDocToVehicle(v.id)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add Custom Document to Vehicle #{index + 1}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Remarks */}
            <div className="glass-card p-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Overall Customer Remarks (Optional)
              </label>
              <textarea
                maxLength={500}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none text-sm"
                placeholder="Any special notes regarding this customer or their fleet of vehicles..."
              />
              <div className="text-right text-xs text-slate-500 mt-1">{remarks.length}/500</div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link
                to="/customers"
                className="px-6 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                &larr; Cancel
              </Link>

              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={addVehicle}
                  className="flex-1 sm:flex-initial px-5 py-3 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl text-sm font-bold transition-all"
                >
                  + Add Another Vehicle
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !!duplicateCustomer || isCheckingPhone}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:-translate-y-0.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registering...
                    </>
                  ) : isCheckingPhone ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking Phone...
                    </>
                  ) : duplicateCustomer ? (
                    'Duplicate Number – Cannot Register'
                  ) : (
                    `Complete Registration (${vehicles.length} ${vehicles.length === 1 ? 'Vehicle' : 'Vehicles'})`
                  )}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
