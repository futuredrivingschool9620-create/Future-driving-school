import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { prisma } from '../lib/prisma.js';
import { PdfParserService, type ParsedCustomerRecord } from './pdfParser.service.js';
import { validateAndFormatVehicleNumber } from '../validators/customer.schema.js';
import { AuditService } from './audit.service.js';
import { SSEService } from './sse.service.js';

export interface EvaluatedCustomerRecord extends ParsedCustomerRecord {
  status: 'VALID' | 'DUPLICATE' | 'INVALID';
  statusReason?: string;
  matchedExistingCustomer?: {
    id: string;
    name: string;
    phoneNumber: string;
    vehicleNumber: string;
  };
}

export interface BatchPreviewResult {
  fileName: string;
  fileSize: number;
  totalFound: number;
  validCount: number;
  skippedCount: number;
  invalidCount: number;
  records: EvaluatedCustomerRecord[];
}

export interface ConfirmBatchPayload {
  fileName: string;
  fileBase64: string;
  records: EvaluatedCustomerRecord[];
}

export interface BatchConfirmResult {
  uploadedPdfId: string;
  fileName: string;
  totalFound: number;
  registeredCount: number;
  skippedCount: number;
  invalidCount: number;
  registeredCustomers: Array<{ id: string; name: string; vehicleNumber: string; phoneNumber: string }>;
  skippedCustomers: Array<{ name: string; phone: string; vehicleNumber: string; reason: string }>;
}

export class CustomerBatchService {
  private static readonly UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'reference-pdfs');

  private static ensureUploadsDir() {
    if (!fs.existsSync(this.UPLOADS_DIR)) {
      fs.mkdirSync(this.UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   * Preview and evaluate records extracted from PDF against database rules and existing records.
   */
  static async previewFromPdf(buffer: Buffer, fileName: string): Promise<BatchPreviewResult> {
    const rawRecords = await PdfParserService.parsePdf(buffer);

    // Fetch active customers to check for duplicates
    const existingCustomers = await prisma.customer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        secondName: true,
        phoneNumber: true,
        vehicleNumber: true,
        vehicles: {
          where: { isActive: true },
          select: { vehicleNumber: true },
        },
        drivingLicenceNumber: true,
        documents: {
          where: { isActive: true },
          select: { documentName: true, notes: true },
        },
      },
    });

    const evaluatedRecords: EvaluatedCustomerRecord[] = [];
    const seenPhonesInBatch = new Set<string>();
    const seenVehiclesInBatch = new Set<string>();
    const seenDlsInBatch = new Set<string>();

    for (const record of rawRecords) {
      const reasons: string[] = [];
      let isInvalid = false;
      let isDuplicate = false;
      let matchedCust: EvaluatedCustomerRecord['matchedExistingCustomer'];

      // 1. Validation: Customer Name
      if (!record.firstName || record.firstName.trim().length === 0) {
        isInvalid = true;
        reasons.push('Customer first name is required');
      }

      // 2. Validation: Phone Number (Indian 10-digit mobile)
      const phoneDigits = record.phoneNumber.replace(/\D/g, '');
      const validPhone = /^[6-9]\d{9}$/.test(phoneDigits);
      if (!record.phoneNumber || !validPhone) {
        isInvalid = true;
        reasons.push('Phone number must be a valid 10-digit Indian mobile number (e.g. 9876543210)');
      }

      // 3. Validation: Vehicle Number (Indian registration format)
      let formattedVehicleNumber = record.vehicleNumber;
      if (!record.vehicleNumber) {
        isInvalid = true;
        reasons.push('Vehicle number is required');
      } else {
        const vResult = validateAndFormatVehicleNumber(record.vehicleNumber);
        if (!vResult.valid) {
          isInvalid = true;
          reasons.push(vResult.error || 'Invalid Indian vehicle registration number format');
        } else {
          formattedVehicleNumber = vResult.formatted || record.vehicleNumber.toUpperCase();
        }
      }

      // 4. Validation: Dates if document is provided
      if (record.startDate && isNaN(Date.parse(record.startDate))) {
        isInvalid = true;
        reasons.push('Invalid document start date');
      }
      if (record.endDate && isNaN(Date.parse(record.endDate))) {
        isInvalid = true;
        reasons.push('Invalid document expiry date');
      }
      if (record.startDate && record.endDate) {
        if (new Date(record.endDate) < new Date(record.startDate)) {
          isInvalid = true;
          reasons.push('Document expiry date cannot be earlier than start date');
        }
      }

      // 5. Validation: Driving Licence Number format if provided
      if (record.drivingLicenceNumber) {
        const cleanDl = record.drivingLicenceNumber.replace(/[\s\-]/g, '').toUpperCase();
        if (cleanDl.length < 5 || cleanDl.length > 20) {
          isInvalid = true;
          reasons.push('Driving licence number has an invalid length');
        }
      }

      // If invalid, mark as INVALID and skip DB duplicate checks
      if (isInvalid) {
        evaluatedRecords.push({
          ...record,
          vehicleNumber: formattedVehicleNumber || record.vehicleNumber,
          status: 'INVALID',
          statusReason: reasons.join('; '),
        });
        continue;
      }

      // 6. Duplicate Protection: Check against Database
      // Phone number match
      const phoneMatch = existingCustomers.find(
        (c) => c.phoneNumber.replace(/\D/g, '') === phoneDigits
      );
      if (phoneMatch) {
        isDuplicate = true;
        const matchedVeh = phoneMatch.vehicleNumber || phoneMatch.vehicles?.[0]?.vehicleNumber || '';
        matchedCust = {
          id: phoneMatch.id,
          name: [phoneMatch.firstName, phoneMatch.secondName].filter(Boolean).join(' '),
          phoneNumber: phoneMatch.phoneNumber,
          vehicleNumber: matchedVeh,
        };
        reasons.push(
          `Already Registered – Skipped: Phone number ${phoneDigits} is already registered to ${matchedCust.name} (${matchedVeh})`
        );
      }

      // Vehicle number match (clean comparison)
      if (!isDuplicate) {
        const cleanVehicle = formattedVehicleNumber.replace(/[\s\-]/g, '').toUpperCase();
        const vehMatch = existingCustomers.find(
          (c) =>
            (c.vehicleNumber && c.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase() === cleanVehicle) ||
            c.vehicles.some((v) => v.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase() === cleanVehicle)
        );
        if (vehMatch) {
          isDuplicate = true;
          const matchedVeh = vehMatch.vehicleNumber || vehMatch.vehicles?.find((v) => v.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase() === cleanVehicle)?.vehicleNumber || formattedVehicleNumber;
          matchedCust = {
            id: vehMatch.id,
            name: [vehMatch.firstName, vehMatch.secondName].filter(Boolean).join(' '),
            phoneNumber: vehMatch.phoneNumber,
            vehicleNumber: matchedVeh,
          };
          reasons.push(
            `Already Registered – Skipped: Vehicle ${formattedVehicleNumber} is already registered to ${matchedCust.name}`
          );
        }
      }

      // Driving Licence match
      if (!isDuplicate && record.drivingLicenceNumber) {
        const cleanDl = record.drivingLicenceNumber.replace(/[\s\-]/g, '').toUpperCase();
        const dlMatch = existingCustomers.find(
          (c) =>
            (c.drivingLicenceNumber && c.drivingLicenceNumber.replace(/[\s\-]/g, '').toUpperCase() === cleanDl) ||
            c.documents.some((d) => d.notes && d.notes.replace(/[\s\-]/g, '').toUpperCase().includes(cleanDl))
        );
        if (dlMatch) {
          isDuplicate = true;
          const matchedVeh = dlMatch.vehicleNumber || dlMatch.vehicles?.[0]?.vehicleNumber || '';
          matchedCust = {
            id: dlMatch.id,
            name: [dlMatch.firstName, dlMatch.secondName].filter(Boolean).join(' '),
            phoneNumber: dlMatch.phoneNumber,
            vehicleNumber: matchedVeh,
          };
          reasons.push(
            `Already Registered – Skipped: Driving licence ${record.drivingLicenceNumber} is already registered to ${matchedCust.name}`
          );
        }
      }

      // 7. Duplicate Protection: Check within current batch
      if (!isDuplicate) {
        if (seenPhonesInBatch.has(phoneDigits)) {
          isDuplicate = true;
          reasons.push(`Already Registered – Skipped: Duplicate phone number ${phoneDigits} found within this uploaded PDF`);
        } else if (seenVehiclesInBatch.has(formattedVehicleNumber.replace(/[\s\-]/g, '').toUpperCase())) {
          isDuplicate = true;
          reasons.push(`Already Registered – Skipped: Duplicate vehicle number ${formattedVehicleNumber} found within this uploaded PDF`);
        } else if (record.drivingLicenceNumber && seenDlsInBatch.has(record.drivingLicenceNumber.replace(/[\s\-]/g, '').toUpperCase())) {
          isDuplicate = true;
          reasons.push(`Already Registered – Skipped: Duplicate driving licence ${record.drivingLicenceNumber} found within this uploaded PDF`);
        }
      }

      if (isDuplicate) {
        evaluatedRecords.push({
          ...record,
          vehicleNumber: formattedVehicleNumber,
          status: 'DUPLICATE',
          statusReason: reasons.join('; '),
          matchedExistingCustomer: matchedCust,
        });
      } else {
        seenPhonesInBatch.add(phoneDigits);
        seenVehiclesInBatch.add(formattedVehicleNumber.replace(/[\s\-]/g, '').toUpperCase());
        if (record.drivingLicenceNumber) {
          seenDlsInBatch.add(record.drivingLicenceNumber.replace(/[\s\-]/g, '').toUpperCase());
        }

        evaluatedRecords.push({
          ...record,
          vehicleNumber: formattedVehicleNumber,
          status: 'VALID',
          statusReason: 'Ready to register',
        });
      }
    }

    const validCount = evaluatedRecords.filter((r) => r.status === 'VALID').length;
    const skippedCount = evaluatedRecords.filter((r) => r.status === 'DUPLICATE').length;
    const invalidCount = evaluatedRecords.filter((r) => r.status === 'INVALID').length;

    return {
      fileName,
      fileSize: buffer.length,
      totalFound: evaluatedRecords.length,
      validCount,
      skippedCount,
      invalidCount,
      records: evaluatedRecords,
    };
  }

  /**
   * Confirm and register valid records, save uploaded PDF to disk and database.
   */
  static async confirmAndRegisterBatch(
    payload: ConfirmBatchPayload,
    adminId: string,
    ipAddress?: string
  ): Promise<BatchConfirmResult> {
    this.ensureUploadsDir();

    const { fileName, fileBase64, records } = payload;
    const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    // Save PDF file to storage path
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = path.join(this.UPLOADS_DIR, safeName);
    fs.writeFileSync(storagePath, fileBuffer);

    // Initial DB record for UploadedPdf
    const uploadedPdf = await (prisma as any).uploadedPdf.create({
      data: {
        fileName,
        fileSize: fileBuffer.length,
        mimeType: 'application/pdf',
        storagePath,
        fileData: cleanBase64.length < 5000000 ? cleanBase64 : null, // store base64 if < 5MB
        totalFound: records.length,
        uploadedByAdminId: adminId,
      },
    });

    const registeredCustomers: BatchConfirmResult['registeredCustomers'] = [];
    const skippedCustomers: BatchConfirmResult['skippedCustomers'] = [];
    let invalidCount = 0;

    // Filter only records intended for registration
    for (const record of records) {
      if (record.status === 'INVALID') {
        invalidCount++;
        continue;
      }
      if (record.status === 'DUPLICATE') {
        skippedCustomers.push({
          name: [record.firstName, record.secondName].filter(Boolean).join(' '),
          phone: record.phoneNumber,
          vehicleNumber: record.vehicleNumber,
          reason: record.statusReason || 'Already registered in database',
        });
        continue;
      }

      // Re-verify against database in case changes occurred between preview and confirm
      const cleanPhone = record.phoneNumber.replace(/\D/g, '');
      const cleanVeh = record.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase();

      const existingPhone = await prisma.customer.findFirst({
        where: { phoneNumber: cleanPhone, isActive: true },
      });
      if (existingPhone) {
        skippedCustomers.push({
          name: [record.firstName, record.secondName].filter(Boolean).join(' '),
          phone: record.phoneNumber,
          vehicleNumber: record.vehicleNumber,
          reason: `Phone number ${cleanPhone} already exists in database`,
        });
        continue;
      }

      const existingVeh = await prisma.customer.findFirst({
        where: {
          isActive: true,
          OR: [
            { vehicleNumber: record.vehicleNumber },
            { vehicleNumber: cleanVeh },
          ],
        },
      });
      if (existingVeh) {
        skippedCustomers.push({
          name: [record.firstName, record.secondName].filter(Boolean).join(' '),
          phone: record.phoneNumber,
          vehicleNumber: record.vehicleNumber,
          reason: `Vehicle number ${record.vehicleNumber} already exists in database`,
        });
        continue;
      }

      // If driving licence is present, check existing
      if (record.drivingLicenceNumber) {
        const cleanDl = record.drivingLicenceNumber.replace(/[\s\-]/g, '').toUpperCase();
        const existingDl = await prisma.customer.findFirst({
          where: {
            isActive: true,
            drivingLicenceNumber: cleanDl,
          },
        });
        if (existingDl) {
          skippedCustomers.push({
            name: [record.firstName, record.secondName].filter(Boolean).join(' '),
            phone: record.phoneNumber,
            vehicleNumber: record.vehicleNumber,
            reason: `Driving licence ${record.drivingLicenceNumber} already exists in database`,
          });
          continue;
        }
      }

      // Register the new customer
      const vResult = validateAndFormatVehicleNumber(record.vehicleNumber);
      const vehicleNumberFormatted = vResult.formatted || record.vehicleNumber.toUpperCase();

      const newCustomer = await prisma.$transaction(async (tx) => {
        const cust = await tx.customer.create({
          data: {
            firstName: record.firstName.trim(),
            secondName: record.secondName?.trim() || null,
            vehicleType: record.vehicleType || null,
            phoneNumber: cleanPhone,
            vehicleNumber: vehicleNumberFormatted,
            drivingLicenceNumber: record.drivingLicenceNumber?.trim().toUpperCase() || null,
            remarks: record.remarks?.trim() || null,
            createdByAdminId: adminId,
            updatedByAdminId: adminId,
            uploadedPdfId: uploadedPdf.id,
          },
        });

        const veh = await tx.vehicle.create({
          data: {
            customerId: cust.id,
            vehicleNumber: vehicleNumberFormatted,
            vehicleType: record.vehicleType || '4 Wheeler',
            status: 'Active',
            notes: record.remarks || null,
            isActive: true,
            createdByAdminId: adminId,
            updatedByAdminId: adminId,
          },
        });

        // If document info is present, create Document record
        if (record.documentName && record.startDate && record.endDate) {
          await tx.document.create({
            data: {
              customerId: cust.id,
              vehicleId: veh.id,
              documentName: record.documentName.trim(),
              startDate: new Date(record.startDate),
              endDate: new Date(record.endDate),
              notes: record.remarks || null,
              isActive: true,
              isCurrent: true,
              createdByAdminId: adminId,
            },
          });
        }

        return cust;
      });

      registeredCustomers.push({
        id: newCustomer.id,
        name: [newCustomer.firstName, newCustomer.secondName].filter(Boolean).join(' '),
        vehicleNumber: newCustomer.vehicleNumber || vehicleNumberFormatted,
        phoneNumber: newCustomer.phoneNumber,
      });
    }

    // Update UploadedPdf stats
    await (prisma as any).uploadedPdf.update({
      where: { id: uploadedPdf.id },
      data: {
        registeredCount: registeredCustomers.length,
        skippedCount: skippedCustomers.length,
        invalidCount,
        summaryNotes: `Batch processed: ${registeredCustomers.length} registered, ${skippedCustomers.length} skipped, ${invalidCount} invalid.`,
      },
    });

    // Log Audit entry
    await AuditService.log({
      adminId,
      entityType: 'CustomerBatch',
      entityId: uploadedPdf.id,
      action: 'CREATE',
      newData: {
        fileName,
        totalFound: records.length,
        registeredCount: registeredCustomers.length,
        skippedCount: skippedCustomers.length,
        invalidCount,
      },
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { batchId: uploadedPdf.id } });

    return {
      uploadedPdfId: uploadedPdf.id,
      fileName,
      totalFound: records.length,
      registeredCount: registeredCustomers.length,
      skippedCount: skippedCustomers.length,
      invalidCount,
      registeredCustomers,
      skippedCustomers,
    };
  }

  /**
   * List all uploaded reference PDFs with pagination and stats.
   */
  static async getUploadedPdfs(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      (prisma as any).uploadedPdf.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          uploadedByAdmin: { select: { id: true, username: true } },
          customers: { select: { id: true, firstName: true, secondName: true, vehicleNumber: true } },
        },
      }),
      (prisma as any).uploadedPdf.count(),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single uploaded PDF file for streaming/downloading.
   */
  static async getUploadedPdfFile(id: string): Promise<{ fileName: string; mimeType: string; buffer: Buffer }> {
    const record = await (prisma as any).uploadedPdf.findUnique({
      where: { id },
    });

    if (!record) {
      throw new Error('Uploaded PDF not found');
    }

    if (fs.existsSync(record.storagePath)) {
      const buffer = fs.readFileSync(record.storagePath);
      return { fileName: record.fileName, mimeType: record.mimeType, buffer };
    }

    if (record.fileData) {
      const buffer = Buffer.from(record.fileData, 'base64');
      return { fileName: record.fileName, mimeType: record.mimeType, buffer };
    }

    throw new Error('PDF file content is no longer available on the server');
  }

  /**
   * Generate a sample template PDF that admins can download to understand the supported layout.
   */
  static generateSamplePdf(): Buffer {
    const doc = new jsPDF('landscape');

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('Customer Batch Registration Template', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Use this template layout to upload multiple customers in a single PDF. Columns can be adjusted or exported from your sheets.',
      14,
      25
    );

    const headers = [
      ['Customer Name', 'Reference Name', 'Phone Number', 'Vehicle Number', 'Vehicle Type', 'Document', 'Start Date', 'Expiry Date', 'DL Number', 'Remarks'],
    ];

    const data = [
      ['Aarav Sharma', 'Suresh Kumar', '9876543210', 'KA 01 AB 1234', '4 Wheeler', 'Insurance', '2025-01-01', '2026-01-01', 'KA0120150001234', 'Private car policy'],
      ['Priya Patel', 'Direct', '9123456780', 'MH 12 CD 5678', '2 Wheeler', 'FC', '2024-06-15', '2025-06-15', 'MH1220180005678', 'Two-wheeler fitness'],
      ['Rohan Verma', 'Anil Mehta', '9988776655', 'DL 08 EF 9012', 'Truck', 'Tax', '2024-10-01', '2025-09-30', 'DL0820200009012', 'Commercial road tax'],
      ['Sneha Kulkarni', 'Sunita', '9845123456', 'TN 07 GH 3456', '4 Wheeler', 'Permit', '2025-02-01', '2026-01-31', 'TN0720190003456', 'Tourist permit'],
      ['Mohammed Ali', '', '9731234567', 'KA 05 IJ 7890', '4 Wheeler', 'Insurance', '2024-12-01', '2025-11-30', 'KA0520160007890', 'Comprehensive policy'],
    ];

    (autoTable as any)(doc, {
      head: headers,
      body: data,
      startY: 32,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        cellPadding: 3,
        overflow: 'linebreak',
      },
    });

    return Buffer.from(doc.output('arraybuffer'));
  }
}
