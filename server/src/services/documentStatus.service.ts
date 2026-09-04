import { Document } from '@prisma/client';
import { calculateDocumentStatus, getDaysRemaining, DocumentStatus } from '../utils/dateHelpers.js';

export interface DocumentWithStatus {
  id: string;
  documentName: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isCurrent: boolean;
  renewalVersion: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: DocumentStatus;
  daysRemaining: number;
}

export interface CustomerDocumentSummary {
  [documentName: string]: DocumentWithStatus;
}

export class DocumentStatusService {
  /**
   * Enriches a single document with computed status and days remaining.
   */
  static enrichDocumentWithStatus(doc: Document): DocumentWithStatus {
    return {
      id: doc.id,
      documentName: doc.documentName,
      startDate: doc.startDate,
      endDate: doc.endDate,
      isActive: doc.isActive,
      isCurrent: doc.isCurrent,
      renewalVersion: doc.renewalVersion,
      notes: doc.notes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      status: calculateDocumentStatus(doc.endDate),
      daysRemaining: getDaysRemaining(doc.endDate),
    };
  }

  /**
   * Enriches a customer's documents organized by name.
   * Returns current documents as a key-value map (e.g., { Insurance: {...}, FC: {...}, Tax: {...} })
   */
  static buildDocumentSummary(documents: Document[]): CustomerDocumentSummary {
    const summary: CustomerDocumentSummary = {};

    for (const doc of documents) {
      if (doc.isCurrent && doc.isActive) {
        summary[doc.documentName] = this.enrichDocumentWithStatus(doc);
      }
    }

    return summary;
  }

  /**
   * Filters documents by computed status.
   * Used for dashboard filtering where status is derived, not stored.
   */
  static filterByStatus(
    documents: Document[],
    targetStatus: DocumentStatus
  ): Document[] {
    return documents.filter(
      (doc) => calculateDocumentStatus(doc.endDate) === targetStatus
    );
  }
}
