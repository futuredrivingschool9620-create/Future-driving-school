import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { customerApi } from '../../lib/api';
import { validateAndFormatVehicleNumber } from '../../lib/vehicleValidation';

interface DocumentInput {
  id: string; // for internal React key
  documentName: string;
  startDate: string;
  endDate: string;
}

export default function CustomerRegistrationPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Customer basic info
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [vehicleType, setVehicleType] = useState<'2 Wheeler' | '4 Wheeler' | 'Truck'>('4 Wheeler');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [remarks, setRemarks] = useState('');

  // Documents
  const [documents, setDocuments] = useState<DocumentInput[]>([
    { id: crypto.randomUUID(), documentName: 'Insurance', startDate: '', endDate: '' },
    { id: crypto.randomUUID(), documentName: 'FC', startDate: '', endDate: '' },
    { id: crypto.randomUUID(), documentName: 'Tax', startDate: '', endDate: '' }
  ]);

  const addDocument = () => {
    setDocuments([
      ...documents,
      { id: crypto.randomUUID(), documentName: '', startDate: '', endDate: '' }
    ]);
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const updateDocument = (id: string, field: keyof DocumentInput, value: string) => {
    setDocuments(documents.map(doc => doc.id === id ? { ...doc, [field]: value } : doc));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const vResult = validateAndFormatVehicleNumber(vehicleNumber);
    if (!vResult.valid) {
      setVehicleError(vResult.error || 'Invalid vehicle number');
      setError(vResult.error || 'Invalid vehicle number');
      setIsSubmitting(false);
      return;
    }

    try {
      // Filter out empty documents (must have name and both dates)
      const validDocuments = documents
        .filter(doc => doc.documentName.trim() && doc.startDate && doc.endDate)
        .map(({ documentName, startDate, endDate }) => ({
          documentName: documentName.trim(),
          startDate,
          endDate,
        }));

      const res = await customerApi.create({
        firstName: firstName.trim(),
        secondName: secondName.trim() || undefined,
        vehicleType,
        phoneNumber: phoneNumber.trim(),
        vehicleNumber: vResult.formatted || vehicleNumber.trim().toUpperCase(),
        remarks: remarks.trim() || undefined,
        documents: validDocuments,
      });

      navigate(`/customers/${res.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to register customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>New Customer Registration</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Register a new customer, their vehicle, and associated documents in one step.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
          </svg>
          <div>
            <p className="font-medium">Registration Failed</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Details Card */}
        <div className="glass-card p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs">1</span>
            Customer & Vehicle Details
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reference Name (Optional)</label>
              <input
                type="text"
                value={secondName}
                onChange={e => setSecondName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="Referred by / Reference person (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Phone Number *</label>
              <input
                type="tel"
                required
                pattern="^[6-9][0-9]{9}$"
                title="Please enter a valid 10-digit Indian mobile number."
                maxLength={10}
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="+91 9876543210"
              />
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
                className={`w-full px-4 py-3 rounded-xl border ${vehicleError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors uppercase font-mono`}
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
              Vehicle Type *
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

        {/* Documents Card */}
        <div className="glass-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs">2</span>
              Documents Setup
            </h2>
            <button
              type="button"
              onClick={addDocument}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Another Document
            </button>
          </div>

          <div className="space-y-4">
            {documents.map((doc, index) => (
              <div key={doc.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 relative group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {index >= 3 && (
                  <button
                    type="button"
                    onClick={() => removeDocument(doc.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110"
                    title="Remove document"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Document Name</label>
                    <input
                      type="text"
                      value={doc.documentName}
                      onChange={e => updateDocument(doc.id, 'documentName', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Pollution Certificate"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={doc.startDate}
                      onChange={e => updateDocument(doc.id, 'startDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Expiry Date</label>
                    <input
                      type="date"
                      value={doc.endDate}
                      onChange={e => updateDocument(doc.id, 'endDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4 italic">
            * Documents with empty fields will be skipped during registration.
          </p>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            to="/customers"
            className="px-6 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Registering...
              </>
            ) : (
              'Complete Registration'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
