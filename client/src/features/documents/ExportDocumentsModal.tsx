import { useState, useEffect, useCallback } from 'react';
import { documentApi } from '../../lib/api';
import type { FilteredDocument } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';
import { exportDocumentsToPDF, exportDocumentsToExcel } from '../../lib/exportUtils';

interface ExportDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportDocumentsModal({ isOpen, onClose }: ExportDocumentsModalProps) {
  // Date range defaults: Current month start to 60 days ahead
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const defaultToDate = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState<string>(firstDayOfMonth);
  const [dateTo, setDateTo] = useState<string>(defaultToDate);
  const [dateType, setDateType] = useState<'endDate' | 'startDate'>('endDate');
  const [exportFormat, setExportFormat] = useState<'PDF' | 'EXCEL'>('PDF');

  const [documents, setDocuments] = useState<FilteredDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch preview records based on current date range
  const fetchExportRecords = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setDocuments([]);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const res = await documentApi.filter({
        dateFrom,
        dateTo,
        dateType,
        page: 1,
        limit: 5000, // Fetch all matching records for the export
      });
      setDocuments(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch records for export:', err);
      setError('Failed to fetch documents for the selected dates. Please try again.');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, dateType]);

  useEffect(() => {
    if (isOpen) {
      fetchExportRecords();
    }
  }, [isOpen, fetchExportRecords]);

  // Preset Date Ranges
  const applyPreset = (preset: 'THIS_MONTH' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS' | 'ALL_TIME') => {
    const now = new Date();
    if (preset === 'THIS_MONTH') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setDateFrom(from);
      setDateTo(to);
    } else if (preset === 'NEXT_30_DAYS') {
      const from = now.toISOString().split('T')[0];
      const future = new Date(now);
      future.setDate(future.getDate() + 30);
      setDateFrom(from);
      setDateTo(future.toISOString().split('T')[0]);
    } else if (preset === 'NEXT_90_DAYS') {
      const from = now.toISOString().split('T')[0];
      const future = new Date(now);
      future.setDate(future.getDate() + 90);
      setDateFrom(from);
      setDateTo(future.toISOString().split('T')[0]);
    } else if (preset === 'ALL_TIME') {
      setDateFrom('2020-01-01');
      const future = new Date(now.getFullYear() + 10, 11, 31).toISOString().split('T')[0];
      setDateTo(future);
    }
  };

  const handleDownload = () => {
    if (documents.length === 0) return;
    setIsExporting(true);
    try {
      if (exportFormat === 'PDF') {
        exportDocumentsToPDF(documents, { from: dateFrom, to: dateTo, dateType });
      } else {
        exportDocumentsToExcel(documents, { from: dateFrom, to: dateTo, dateType });
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setError('Failed to generate export file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Export Documents</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Filter documents by date range and download formatted PDF or Excel reports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Preset Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Quick Date Presets
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Filter by:</span>
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as 'endDate' | 'startDate')}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value="endDate">Expiry Date (End Date)</option>
                  <option value="startDate">Start Date</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'NEXT_30_DAYS', label: 'Next 30 Days' },
                { id: 'NEXT_90_DAYS', label: 'Next 90 Days' },
                { id: 'ALL_TIME', label: 'All Active Records' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as any)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                From Date *
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                To Date *
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select Export Format *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat('PDF')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                  exportFormat === 'PDF'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                  PDF
                </div>
                <div className="text-left">
                  <div className="text-sm leading-tight">PDF Document</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">Clean printable table</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('EXCEL')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                  exportFormat === 'EXCEL'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  XLSX
                </div>
                <div className="text-left">
                  <div className="text-sm leading-tight">Excel Spreadsheet</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">Formatted .xlsx data</div>
                </div>
              </button>
            </div>
          </div>

          {/* Preview & Count Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Records Preview
                </span>
                {isLoading ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Calculating...
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      documents.length > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {documents.length} document{documents.length !== 1 ? 's' : ''} found
                  </span>
                )}
              </div>

              {documents.length > 0 && (
                <span className="text-[11px] text-slate-500">Showing first {Math.min(documents.length, 5)} records</span>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800">
                {error}
              </div>
            )}

            {/* Preview List or Empty State */}
            {!isLoading && documents.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No documents found for the selected date range.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting the From Date or To Date above, or select "All Active Records".
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {documents.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {doc.customer.firstName} {doc.customer.secondName || ''}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {doc.customer.vehicleNumber} &bull; {doc.customer.phoneNumber}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {doc.documentName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Exp: {new Date(doc.endDate).toLocaleDateString('en-IN')}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <StatusBadge status={doc.status} daysRemaining={doc.daysRemaining} compact />
                      </div>
                    </div>
                  ))}
                </div>
                {documents.length > 5 && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 text-center text-xs text-slate-500 font-medium border-t border-slate-100 dark:border-slate-800">
                    + {documents.length - 5} more record{documents.length - 5 !== 1 ? 's' : ''} will be included in the download
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={documents.length === 0 || isLoading || isExporting}
            onClick={handleDownload}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating {exportFormat}...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Download {exportFormat === 'PDF' ? 'PDF File' : 'Excel (.xlsx)'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
