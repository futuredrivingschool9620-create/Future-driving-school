import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { documentApi, dashboardApi } from '../../lib/api';
import type { FilteredDocument, UploadedPdfRecord } from '../../types';
import StatusBadge from '../../components/shared/StatusBadge';
import ExportDocumentsModal from './ExportDocumentsModal';
import { useVirtualTable } from '../../hooks/useVirtualTable';

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'uploaded-pdfs' ? 'uploaded-pdfs' : 'expiries';

  // Expiry documents state
  const [documents, setDocuments] = useState<FilteredDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Uploaded Reference PDFs state
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdfRecord[]>([]);
  const [isPdfsLoading, setIsPdfsLoading] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [totalPdfPages, setTotalPdfPages] = useState(1);
  const [totalPdfItems, setTotalPdfItems] = useState(0);
  const [selectedPdfDetail, setSelectedPdfDetail] = useState<UploadedPdfRecord | null>(null);

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Renewal state
  const [renewingDoc, setRenewingDoc] = useState<FilteredDocument | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);

  // Delete document state
  const [documentToDelete, setDocumentToDelete] = useState<FilteredDocument | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [deleteDocumentError, setDeleteDocumentError] = useState('');

  // Expiry check & reminder triggers
  const [isRunningExpiryCheck, setIsRunningExpiryCheck] = useState(false);
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);
  const [alertNotice, setAlertNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Virtualization for documents and uploaded PDFs
  const {
    containerRef: docContainerRef,
    visibleItems: visibleDocs,
    topSpacerHeight: docTopSpacer,
    bottomSpacerHeight: docBottomSpacer,
  } = useVirtualTable({ items: documents, estimatedRowHeight: 72 });

  const {
    containerRef: pdfContainerRef,
    visibleItems: visiblePdfs,
    topSpacerHeight: pdfTopSpacer,
    bottomSpacerHeight: pdfBottomSpacer,
  } = useVirtualTable({ items: uploadedPdfs, estimatedRowHeight: 64 });

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

  const fetchUploadedPdfs = useCallback(async () => {
    try {
      setIsPdfsLoading(true);
      const res = await documentApi.getUploadedPdfs(pdfPage, 15);
      setUploadedPdfs(res.data);
      setTotalPdfPages(res.pagination.totalPages);
      setTotalPdfItems(res.pagination.total);
    } catch (error) {
      console.error('Failed to fetch uploaded PDFs:', error);
    } finally {
      setIsPdfsLoading(false);
    }
  }, [pdfPage]);

  useEffect(() => {
    if (activeTab === 'expiries') {
      fetchDocuments();
    } else {
      fetchUploadedPdfs();
    }
  }, [activeTab, fetchDocuments, fetchUploadedPdfs]);

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

  const handleConfirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    try {
      setIsDeletingDocument(true);
      setDeleteDocumentError('');
      await documentApi.delete(documentToDelete.id);
      setDocumentToDelete(null);
      fetchDocuments();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      setDeleteDocumentError(error?.response?.data?.error || 'Failed to delete document.');
    } finally {
      setIsDeletingDocument(false);
    }
  };

  const handleRunExpiryCheck = async () => {
    try {
      setIsRunningExpiryCheck(true);
      setAlertNotice(null);
      const res = await dashboardApi.triggerCheck();
      const sentMsg = res.notificationsSent !== undefined
        ? `✅ Expiry check finished! Scanned ${res.totalDocumentsScanned || 0} documents. Sent ${res.notificationsSent} WhatsApp reminder(s) (${res.skipped || 0} skipped).`
        : res.message || '✅ Expiry check completed successfully!';
      setAlertNotice({ type: 'success', message: sentMsg });
      fetchDocuments();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to run expiry check';
      setAlertNotice({ type: 'error', message: errMsg });
    } finally {
      setIsRunningExpiryCheck(false);
    }
  };

  const handleSendWhatsApp = async (doc: FilteredDocument) => {
    try {
      setSendingDocId(doc.id);
      setAlertNotice(null);
      const res = await documentApi.sendReminder(doc.id);
      setAlertNotice({
        type: 'success',
        message: res.message || `✅ WhatsApp reminder sent to ${doc.customer.firstName} (${doc.customer.phoneNumber})!`,
      });
      fetchDocuments();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to send WhatsApp message';
      setAlertNotice({ type: 'error', message: errMsg });
    } finally {
      setSendingDocId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Alert Notice Banner */}
      {alertNotice && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border shadow-lg transition-all animate-fadeIn ${
            alertNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {alertNotice.type === 'success' ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 8.25h.008v.008H12v-.008Z" />
                </svg>
              </div>
            )}
            <span className="text-sm font-semibold">{alertNotice.message}</span>
          </div>
          <button
            onClick={() => setAlertNotice(null)}
            className="text-xs font-bold px-2 py-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Documents & Expiry Control
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Manage customer document expiries, automated WhatsApp reminders, and PDF archives
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Send All Expiry Reminders Button */}
          <button
            type="button"
            onClick={handleRunExpiryCheck}
            disabled={isRunningExpiryCheck}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Scan all documents and immediately send WhatsApp reminders for due and expired documents"
          >
            {isRunningExpiryCheck ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Scanning & Sending...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <span>Send WhatsApp Reminders Now</span>
              </>
            )}
          </button>

          <Link
            to="/customers/new?mode=pdf"
            className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all shadow-sm hover:scale-105"
          >
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Upload Customer PDF
          </Link>

          {activeTab === 'expiries' && (
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
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'expiries' })}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'expiries'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
          Customer Documents & Expiries
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === 'expiries' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
            {totalItems}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'uploaded-pdfs' })}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'uploaded-pdfs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Uploaded Reference PDFs
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === 'uploaded-pdfs' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
            {totalPdfItems}
          </span>
        </button>
      </div>

      {activeTab === 'uploaded-pdfs' ? (
        /* Uploaded Reference PDFs Table */
        <div className="glass-card overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Uploaded Reference PDF Archives
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every uploaded multi-customer PDF is permanently stored here for audit, verification, and re-download.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchUploadedPdfs}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>

          <div ref={pdfContainerRef} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">File Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Uploaded Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Uploaded By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customers Found</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered / Skipped</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white/50 dark:bg-slate-900/50">
                {isPdfsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="mt-3 text-slate-500 text-sm">Loading uploaded PDFs...</p>
                    </td>
                  </tr>
                ) : uploadedPdfs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <p className="text-slate-900 dark:text-white font-medium text-base">No uploaded PDFs yet</p>
                      <p className="text-slate-500 text-xs mt-1">
                        Use the &ldquo;Upload Customer PDF&rdquo; button on the Customer Registration page to upload a batch.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {pdfTopSpacer > 0 && (
                      <tr style={{ height: pdfTopSpacer, border: 0 }}><td colSpan={7} style={{ height: pdfTopSpacer, padding: 0, border: 0 }} /></tr>
                    )}
                    {visiblePdfs.map(({ item: pdf }) => (
                      <tr key={pdf.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              {pdf.fileName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              ID: {pdf.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        {new Date(pdf.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                        {pdf.uploadedByAdmin?.username || 'Admin'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900 dark:text-white">
                        {pdf.totalFound}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs space-x-1.5">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {pdf.registeredCount} registered
                        </span>
                        {pdf.skippedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {pdf.skippedCount} skipped
                          </span>
                        )}
                        {pdf.invalidCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            {pdf.invalidCount} invalid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {(pdf.fileSize / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPdfDetail(pdf)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Details
                        </button>
                        <a
                          href={documentApi.getUploadedPdfDownloadUrl(pdf.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all inline-flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                  {pdfBottomSpacer > 0 && (
                    <tr style={{ height: pdfBottomSpacer, border: 0 }}><td colSpan={7} style={{ height: pdfBottomSpacer, padding: 0, border: 0 }} /></tr>
                  )}
                </>
                )}
              </tbody>
            </table>
          </div>

          {/* Uploaded PDFs Pagination */}
          {totalPdfPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-900 dark:text-white">{pdfPage}</span> of{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{totalPdfPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                  disabled={pdfPage === 1}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPdfPage((p) => Math.min(totalPdfPages, p + 1))}
                  disabled={pdfPage === totalPdfPages}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Customer Expiry Table View */
        <>
          {/* Quick Filter */}
          <div className="flex flex-wrap items-center justify-end gap-3">
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
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div ref={docContainerRef} className="overflow-x-auto">
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
                    <>
                      {docTopSpacer > 0 && (
                        <tr style={{ height: docTopSpacer, border: 0 }}><td colSpan={6} style={{ height: docTopSpacer, padding: 0, border: 0 }} /></tr>
                      )}
                      {visibleDocs.map(({ item: doc }) => (
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(doc)}
                              disabled={sendingDocId === doc.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                              title={`Send WhatsApp renewal reminder to ${doc.customer.phoneNumber}`}
                            >
                              {sendingDocId === doc.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                                </svg>
                              )}
                              <span>WhatsApp</span>
                            </button>

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

                            <button
                              type="button"
                              onClick={() => {
                                setDocumentToDelete(doc);
                                setDeleteDocumentError('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                              title={`Delete ${doc.documentName}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {docBottomSpacer > 0 && (
                      <tr style={{ height: docBottomSpacer, border: 0 }}><td colSpan={6} style={{ height: docBottomSpacer, padding: 0, border: 0 }} /></tr>
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
        </>
      )}

      {/* PDF Detail Modal */}
      {selectedPdfDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-card max-w-lg w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>PDF Details:</span>
                <span className="text-indigo-600 dark:text-indigo-400">{selectedPdfDetail.fileName}</span>
              </h3>
              <button
                onClick={() => setSelectedPdfDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500">Uploaded Date:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(selectedPdfDetail.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Uploaded By:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPdfDetail.uploadedByAdmin?.username || 'Admin'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total Customers Found:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPdfDetail.totalFound}</span>
                </div>
                <div>
                  <span className="text-slate-500">Registered Count:</span>{' '}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedPdfDetail.registeredCount}</span>
                </div>
              </div>

              {selectedPdfDetail.summaryNotes && (
                <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300">
                  {selectedPdfDetail.summaryNotes}
                </div>
              )}

              {selectedPdfDetail.customers && selectedPdfDetail.customers.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5 uppercase tracking-wider text-[11px]">
                    Associated Registered Customers:
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {selectedPdfDetail.customers.map(c => (
                      <Link
                        key={c.id}
                        to={`/customers/${c.id}`}
                        onClick={() => setSelectedPdfDetail(null)}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-between text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <span className="font-medium">{c.firstName} {c.secondName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{c.vehicleNumber}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPdfDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
              >
                Close
              </button>
              <a
                href={documentApi.getUploadedPdfDownloadUrl(selectedPdfDetail.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                Download PDF
              </a>
            </div>
          </div>
        </div>
      )}

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

      {/* Delete Document Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Document &ldquo;{documentToDelete.documentName}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this {documentToDelete.documentName} document for customer{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {documentToDelete.customer?.firstName} {documentToDelete.customer?.secondName || ''}
                </span>{' '}
                ({documentToDelete.customer?.vehicleNumber || 'Vehicle'})? This action cannot be undone.
              </p>
            </div>

            {deleteDocumentError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-600 text-xs font-semibold">
                {deleteDocumentError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingDocument}
                onClick={() => setDocumentToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingDocument}
                onClick={handleConfirmDeleteDocument}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingDocument ? 'Deleting...' : 'Delete Document'}
              </button>
            </div>
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
