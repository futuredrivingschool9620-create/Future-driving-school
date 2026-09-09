import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { customerApi } from '../../lib/api';
import type { EvaluatedCustomerRecord, BatchPreviewResponse, BatchConfirmResponse } from '../../types';

export default function UploadedPdfSection() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string>('');
  
  // Preview data
  const [previewData, setPreviewData] = useState<BatchPreviewResponse | null>(null);
  const [records, setRecords] = useState<EvaluatedCustomerRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'DUPLICATE' | 'INVALID'>('ALL');
  
  // Editing state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EvaluatedCustomerRecord>>({});

  // Confirmation & Registration State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmResult, setConfirmResult] = useState<BatchConfirmResponse | null>(null);
  const [submitError, setSubmitError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setExtractError('Please select a valid PDF file (.pdf)');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setExtractError('File size exceeds the 10MB limit.');
      return;
    }

    setFile(selectedFile);
    setExtractError('');
    setConfirmResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setFileBase64(base64);
      // Auto-extract immediately upon selection
      await parsePdfPreview(selectedFile.name, base64);
    };
    reader.readAsDataURL(selectedFile);
  };

  const parsePdfPreview = async (fileName: string, base64: string) => {
    try {
      setIsExtracting(true);
      setExtractError('');
      const res = await customerApi.previewPdfBatch(fileName, base64);
      setPreviewData(res);
      setRecords(res.records);
    } catch (err: any) {
      console.error('Failed to preview PDF:', err);
      setExtractError(err.response?.data?.error || 'Failed to read and parse the uploaded PDF. Please verify its content.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const blob = await customerApi.downloadSamplePdf();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Customer_Registration_Sample_Template.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download sample PDF template:', err);
      alert('Failed to download sample PDF. Please try again.');
    }
  };

  const handleRemoveRecord = (tempId: string) => {
    setRecords(prev => prev.filter(r => r.tempId !== tempId));
  };

  const handleStartEdit = (record: EvaluatedCustomerRecord) => {
    setEditingRecordId(record.tempId);
    setEditForm({ ...record });
  };

  const handleSaveEdit = () => {
    if (!editingRecordId) return;

    setRecords(prev =>
      prev.map(r => {
        if (r.tempId !== editingRecordId) return r;
        const updated = { ...r, ...editForm };
        // Basic re-validation
        const phoneDigits = (updated.phoneNumber || '').replace(/\D/g, '');
        const validPhone = /^[6-9]\d{9}$/.test(phoneDigits);
        const hasName = Boolean(updated.firstName && updated.firstName.trim());
        const hasVeh = Boolean(updated.vehicleNumber && updated.vehicleNumber.trim());

        if (hasName && validPhone && hasVeh) {
          // If it was invalid purely due to phone or name, mark as VALID if not already a duplicate
          if (updated.status === 'INVALID') {
            updated.status = 'VALID';
            updated.statusReason = 'Corrected manually — Ready to register';
          }
        }
        return updated;
      })
    );
    setEditingRecordId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditForm({});
  };

  const handleConfirmBatch = async () => {
    if (!file || !fileBase64 || records.length === 0) return;

    try {
      setIsSubmitting(true);
      setSubmitError('');
      const res = await customerApi.confirmPdfBatch({
        fileName: file.name,
        fileBase64,
        records,
      });
      setConfirmResult(res);
    } catch (err: any) {
      console.error('Failed to register batch:', err);
      setSubmitError(err.response?.data?.error || 'Failed to complete customer registration from PDF.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setFileBase64('');
    setPreviewData(null);
    setRecords([]);
    setConfirmResult(null);
    setExtractError('');
    setSubmitError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered records for table display
  const filteredRecords = records.filter(r => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  const validCount = records.filter(r => r.status === 'VALID').length;
  const skippedCount = records.filter(r => r.status === 'DUPLICATE').length;
  const invalidCount = records.filter(r => r.status === 'INVALID').length;

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="glass-card p-6 sm:p-8 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-slate-50/50 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-slate-900/30 border border-indigo-100 dark:border-indigo-900/40">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                Batch Import
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Duplicate Protected
              </span>
            </div>
            <h2 className="text-xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>
              Upload Customer PDF File
            </h2>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>
              Upload a single PDF containing details of multiple customers. The system will extract customer fields,
              apply Indian vehicle and 10-digit mobile validations, protect against duplicates, and preserve the uploaded PDF in Documents for reference.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download Sample Template PDF
          </button>
        </div>
      </div>

      {/* Error Feedback */}
      {extractError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
          </svg>
          <div>
            <p className="font-semibold">Extraction Notice</p>
            <p className="mt-0.5 opacity-90">{extractError}</p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
          </svg>
          <div>
            <p className="font-semibold">Registration Failed</p>
            <p className="mt-0.5 opacity-90">{submitError}</p>
          </div>
        </div>
      )}

      {/* Success View after Registration Confirmation */}
      {confirmResult ? (
        <div className="glass-card p-6 sm:p-8 space-y-6 border-2 border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Batch Registration Complete</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                PDF &ldquo;{confirmResult.fileName}&rdquo; was processed and stored under the Documents section for reference.
              </p>
            </div>
          </div>

          {/* Results Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Found</p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{confirmResult.totalFound}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Successfully Registered</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{confirmResult.registeredCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 shadow-sm">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Already Registered – Skipped</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{confirmResult.skippedCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 shadow-sm">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Invalid Records</p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{confirmResult.invalidCount}</p>
            </div>
          </div>

          {/* Registered Customers List */}
          {confirmResult.registeredCustomers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Newly Registered Customers ({confirmResult.registeredCustomers.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {confirmResult.registeredCustomers.map(cust => (
                  <Link
                    key={cust.id}
                    to={`/customers/${cust.id}`}
                    className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/70 dark:bg-slate-900/70 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {cust.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {cust.vehicleNumber} &bull; {cust.phoneNumber}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Duplicate Customers List */}
          {confirmResult.skippedCustomers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Skipped Duplicate Records ({confirmResult.skippedCustomers.length})
              </h4>
              <div className="space-y-2">
                {confirmResult.skippedCustomers.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                  >
                    <span className="font-semibold text-amber-900 dark:text-amber-200">
                      {c.name} ({c.vehicleNumber} - {c.phone})
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      {c.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-emerald-200 dark:border-emerald-800">
            <Link
              to="/documents"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20 transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              View Saved PDF in Documents Section
            </Link>

            <button
              type="button"
              onClick={resetAll}
              className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors"
            >
              Upload Another PDF
            </button>
          </div>
        </div>
      ) : !previewData ? (
        /* Upload Drag & Drop Card */
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="glass-card p-10 sm:p-14 border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors flex flex-col items-center justify-center text-center cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner mb-4">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v8.25m-6.75-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {isExtracting ? 'Analyzing and Extracting Customers from PDF...' : 'Click to Upload or Drag & Drop PDF Here'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            Upload any single PDF file (up to 10MB) containing tables or lists of customer registrations.
          </p>

          {isExtracting && (
            <div className="mt-6 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Reading customer records, matching fields, and checking duplicate protection...</span>
            </div>
          )}
        </div>
      ) : (
        /* Preview & Confirmation View */
        <div className="space-y-6">
          {/* File Info & Stats Banner */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    {previewData.fileName}
                    <span className="text-xs font-normal text-slate-500">
                      ({(previewData.fileSize / 1024).toFixed(1)} KB)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Preview of extracted records before saving. Check records and click Register to proceed.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Choose Different PDF
              </button>
            </div>

            {/* Metric Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  statusFilter === 'ALL'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50'
                }`}
              >
                <p className="text-xs font-semibold text-slate-500">Total Extracted</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{records.length}</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('VALID')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  statusFilter === 'VALID'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50'
                }`}
              >
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ready to Register</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{validCount}</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('DUPLICATE')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  statusFilter === 'DUPLICATE'
                    ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50'
                }`}
              >
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Already Registered – Skipped</p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{skippedCount}</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('INVALID')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  statusFilter === 'INVALID'
                    ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50'
                }`}
              >
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Invalid Records</p>
                <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{invalidCount}</p>
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Customer Records Preview ({filteredRecords.length} of {records.length})
              </h3>
              <p className="text-xs text-slate-500 italic">
                * You can edit or remove rows before confirming registration.
              </p>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                <thead className="bg-slate-50/70 dark:bg-slate-800/70 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Customer Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Phone</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Vehicle</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Document</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Validity (Start - End)</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">DL Number</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Reason / Notes</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white/40 dark:bg-slate-900/40">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                        No records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(record => {
                      const isEditing = editingRecordId === record.tempId;

                      if (isEditing) {
                        return (
                          <tr key={record.tempId} className="bg-indigo-50/50 dark:bg-indigo-950/40">
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                Editing
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.firstName || ''}
                                onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                                placeholder="First Name"
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 mb-1"
                              />
                              <input
                                type="text"
                                value={editForm.secondName || ''}
                                onChange={e => setEditForm({ ...editForm, secondName: e.target.value })}
                                placeholder="Ref / Second Name"
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.phoneNumber || ''}
                                onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                placeholder="10-digit phone"
                                maxLength={10}
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 font-mono"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.vehicleNumber || ''}
                                onChange={e => setEditForm({ ...editForm, vehicleNumber: e.target.value.toUpperCase() })}
                                placeholder="KA 01 AB 1234"
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 font-mono uppercase mb-1"
                              />
                              <select
                                value={editForm.vehicleType || '4 Wheeler'}
                                onChange={e => setEditForm({ ...editForm, vehicleType: e.target.value as any })}
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900"
                              >
                                <option value="2 Wheeler">2 Wheeler</option>
                                <option value="4 Wheeler">4 Wheeler</option>
                                <option value="Truck">Truck</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.documentName || ''}
                                onChange={e => setEditForm({ ...editForm, documentName: e.target.value })}
                                placeholder="Insurance, FC..."
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="date"
                                value={editForm.startDate || ''}
                                onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 mb-1"
                              />
                              <input
                                type="date"
                                value={editForm.endDate || ''}
                                onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editForm.drivingLicenceNumber || ''}
                                onChange={e => setEditForm({ ...editForm, drivingLicenceNumber: e.target.value.toUpperCase() })}
                                placeholder="DL Number"
                                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 font-mono"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-500 italic">
                              Make corrections and save
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold mr-1"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-2.5 py-1 bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={record.tempId}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors ${
                            record.status === 'DUPLICATE'
                              ? 'bg-amber-50/20 dark:bg-amber-950/10'
                              : record.status === 'INVALID'
                              ? 'bg-rose-50/20 dark:bg-rose-950/10'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            {record.status === 'VALID' && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Ready
                              </span>
                            )}
                            {record.status === 'DUPLICATE' && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Already Registered – Skipped
                              </span>
                            )}
                            {record.status === 'INVALID' && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Invalid
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                            <div>{record.firstName}</div>
                            {record.secondName && (
                              <div className="text-[11px] text-slate-500">Ref: {record.secondName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                            {record.phoneNumber || <span className="text-rose-500 italic">Missing</span>}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {record.vehicleNumber || <span className="text-rose-500 italic">Missing</span>}
                            </span>
                            {record.vehicleType && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-sans">
                                {record.vehicleType}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {record.documentName || <span className="text-slate-400 italic">None</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                            {record.startDate || record.endDate ? (
                              <span>
                                {record.startDate || '—'} &rarr; {record.endDate || '—'}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No dates</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {record.drivingLicenceNumber || <span className="text-slate-400 italic">—</span>}
                          </td>
                          <td className="px-4 py-3 max-w-xs text-xs">
                            <span
                              className={
                                record.status === 'DUPLICATE'
                                  ? 'text-amber-700 dark:text-amber-300 font-medium'
                                  : record.status === 'INVALID'
                                  ? 'text-rose-600 dark:text-rose-400 font-medium'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }
                            >
                              {record.statusReason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(record)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-2.5 font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecord(record.tempId)}
                              className="text-xs text-rose-500 hover:text-rose-700"
                              title="Remove from batch"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Confirmation Bar */}
            <div className="p-4 sm:p-6 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-white">Duplicate Protection Active:</span>
                {' '}Only valid records will be registered. Records flagged as &ldquo;Already Registered – Skipped&rdquo; or &ldquo;Invalid&rdquo; will not overwrite or duplicate existing customers.
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBatch}
                  disabled={isSubmitting || validCount === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Registering Customers...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Confirm & Register {validCount} Valid {validCount === 1 ? 'Customer' : 'Customers'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
