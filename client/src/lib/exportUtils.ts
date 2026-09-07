import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { FilteredDocument } from '../types';

export interface DateRangeFilter {
  from: string;
  to: string;
  dateType?: 'endDate' | 'startDate';
}

/**
 * Format a full customer name cleanly
 */
function getCustomerName(doc: FilteredDocument): string {
  return [doc.customer.firstName, doc.customer.secondName].filter(Boolean).join(' ') || doc.customer.firstName;
}

/**
 * Format a date to Indian locale (DD/MM/YYYY)
 */
function formatDate(dateStr: string | Date): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN');
  } catch {
    return '-';
  }
}

/**
 * Format document remarks combining document notes and customer remarks
 */
function getRemarks(doc: FilteredDocument): string {
  const parts: string[] = [];
  if (doc.notes) parts.push(doc.notes);
  if (doc.customer.remarks) parts.push(`Cust: ${doc.customer.remarks}`);
  return parts.join(' | ') || '-';
}

/**
 * Export filtered documents to a high-quality, printable PDF file
 */
export function exportDocumentsToPDF(
  documents: FilteredDocument[],
  dateRange: DateRangeFilter
): void {
  // Use landscape A4 for comfortable multi-column layout
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FUTURE DRIVING SCHOOL', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Document Expiry & Compliance Report', 14, 19);

  // Subheader / Metadata
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  const dateCriteriaLabel = dateRange.dateType === 'startDate' ? 'Start Date' : 'Expiry Date';
  const metaText = `Filter: ${dateCriteriaLabel} between ${formatDate(dateRange.from)} and ${formatDate(dateRange.to)} | Total Records: ${documents.length}`;
  doc.text(metaText, 14, 25);

  const generatedDate = `Generated: ${new Date().toLocaleString('en-IN')}`;
  doc.text(generatedDate, pageWidth - 14 - doc.getTextWidth(generatedDate), 25);

  // Prepare table data
  const tableHeaders = [
    '#',
    'Customer Name',
    'Phone Number',
    'Vehicle Number',
    'Document Type',
    'Start Date',
    'End Date',
    'Remarks / Notes',
    'Status',
  ];

  const tableData = documents.map((item, index) => [
    (index + 1).toString(),
    getCustomerName(item),
    item.customer.phoneNumber || '-',
    item.customer.vehicleNumber || '-',
    item.renewalVersion > 1 ? `${item.documentName} (v${item.renewalVersion})` : item.documentName,
    formatDate(item.startDate),
    formatDate(item.endDate),
    getRemarks(item),
    item.status.replace(/_/g, ' '),
  ]);

  // Generate Table
  autoTable(doc, {
    startY: 33,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo-600
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 3,
    },
    styles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate-50
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // #
      1: { cellWidth: 38 },                   // Customer Name
      2: { cellWidth: 28 },                   // Phone Number
      3: { cellWidth: 32 },                   // Vehicle Number
      4: { cellWidth: 32 },                   // Document Type
      5: { cellWidth: 24, halign: 'center' }, // Start Date
      6: { cellWidth: 24, halign: 'center' }, // End Date
      7: { cellWidth: 55 },                   // Remarks
      8: { cellWidth: 24, halign: 'center' }, // Status
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: (data) => {
      // Footer page numbers
      const pageNumber = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const footerText = `Page ${data.pageNumber} of ${pageNumber}`;
      doc.text(
        footerText,
        pageWidth - 14 - doc.getTextWidth(footerText),
        doc.internal.pageSize.getHeight() - 8
      );
      doc.text(
        'Future Driving School Management System • Confidential',
        14,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });

  const fromClean = dateRange.from || 'start';
  const toClean = dateRange.to || 'end';
  doc.save(`Documents_Export_${fromClean}_to_${toClean}.pdf`);
}

/**
 * Export filtered documents to a formatted Excel (.xlsx) file
 */
export function exportDocumentsToExcel(
  documents: FilteredDocument[],
  dateRange: DateRangeFilter
): void {
  const dateCriteriaLabel = dateRange.dateType === 'startDate' ? 'Start Date' : 'Expiry Date';
  
  // Sheet structure with metadata header rows
  const rows: (string | number)[][] = [
    ['Future Driving School — Document Export Report'],
    [`Date Range: ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)} (${dateCriteriaLabel})`],
    [`Total Records: ${documents.length}`, `Generated On: ${new Date().toLocaleString('en-IN')}`],
    [], // Blank separator row
    [
      'Sl. No.',
      'Customer Name',
      'Phone Number',
      'Vehicle Number',
      'Document Type',
      'Start Date',
      'End Date',
      'Remarks / Notes',
      'Status',
    ],
  ];

  documents.forEach((item, index) => {
    rows.push([
      index + 1,
      getCustomerName(item),
      item.customer.phoneNumber || '',
      item.customer.vehicleNumber || '',
      item.renewalVersion > 1 ? `${item.documentName} (v${item.renewalVersion})` : item.documentName,
      formatDate(item.startDate),
      formatDate(item.endDate),
      getRemarks(item),
      item.status.replace(/_/g, ' '),
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set explicit column widths for readability
  worksheet['!cols'] = [
    { wch: 8 },  // Sl. No.
    { wch: 25 }, // Customer Name
    { wch: 16 }, // Phone Number
    { wch: 18 }, // Vehicle Number
    { wch: 20 }, // Document Type
    { wch: 14 }, // Start Date
    { wch: 14 }, // End Date
    { wch: 35 }, // Remarks
    { wch: 16 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Documents');

  const fromClean = dateRange.from || 'start';
  const toClean = dateRange.to || 'end';
  XLSX.writeFile(workbook, `Documents_Export_${fromClean}_to_${toClean}.xlsx`);
}
