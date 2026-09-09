// Shared TypeScript types between frontend components

// ── Enums ──

export const DocumentStatus = {
  ACTIVE: 'ACTIVE',
  UPCOMING: 'UPCOMING',
  DUE_SOON: 'DUE_SOON',
  CRITICAL: 'CRITICAL',
  EXPIRES_TODAY: 'EXPIRES_TODAY',
  EXPIRED: 'EXPIRED',
  RENEWED: 'RENEWED',
  CANCELLED: 'CANCELLED',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

// ── API Response Types ──

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ── Auth ──

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
}

export interface AdminProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ── Documents ──

export interface DocumentWithStatus {
  id: string;
  customerId: string;
  vehicleId?: string | null;
  documentName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrent: boolean;
  renewalVersion: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  status: DocumentStatus;
  daysRemaining: number;
}

export interface CustomerDocumentSummary {
  [documentName: string]: DocumentWithStatus;
}

export interface DocumentHistoryItem extends DocumentWithStatus {
  createdByAdmin?: {
    id: string;
    username: string;
  };
  updatedByAdmin?: {
    id: string;
    username: string;
  };
}

// ── Vehicles ──

export interface Vehicle {
  id: string;
  customerId: string;
  vehicleType: '2 Wheeler' | '4 Wheeler' | 'Truck' | string;
  vehicleNumber: string;
  status: 'Active' | 'Expired' | 'Renewed' | string;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: DocumentWithStatus[];
  currentDocuments?: CustomerDocumentSummary;
  allDocuments?: DocumentWithStatus[];
  renewalHistories?: RenewalHistory[];
  notifications?: Notification[];
}

export interface VehicleItemInput {
  vehicleType: '2 Wheeler' | '4 Wheeler' | 'Truck';
  vehicleNumber: string;
  status?: 'Active' | 'Expired' | 'Renewed';
  notes?: string;
  insurance?: {
    startDate: string;
    endDate: string;
  };
  fc?: {
    startDate: string;
    endDate: string;
  };
  tax?: {
    startDate: string;
    endDate: string;
  };
  documents?: {
    documentName: string;
    startDate: string;
    endDate: string;
    notes?: string;
  }[];
}

// ── Customers ──

export interface Customer {
  id: string;
  firstName: string;
  secondName?: string;
  fullName?: string;
  vehicleType?: '2 Wheeler' | '4 Wheeler' | 'Truck' | string;
  phoneNumber: string;
  vehicleNumber?: string;
  drivingLicenceNumber?: string;
  uploadedPdfId?: string;
  remarks?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  vehicles?: Vehicle[];
  currentDocuments?: CustomerDocumentSummary;
  allDocuments?: DocumentWithStatus[];
}

export interface CreateCustomerInput {
  firstName: string;
  secondName?: string;
  vehicleType?: '2 Wheeler' | '4 Wheeler' | 'Truck' | string;
  phoneNumber: string;
  vehicleNumber?: string;
  remarks?: string;
  documents?: {
    documentName: string;
    startDate: string;
    endDate: string;
  }[];
  vehicles?: VehicleItemInput[];
}

export interface UpdateCustomerInput {
  firstName?: string;
  secondName?: string;
  vehicleType?: '2 Wheeler' | '4 Wheeler' | 'Truck' | string;
  phoneNumber?: string;
  vehicleNumber?: string;
  remarks?: string;
}

export interface CreateDocumentInput {
  documentName: string;
  startDate: string;
  endDate: string;
  notes?: string;
  vehicleId?: string;
}

export interface RenewDocumentInput {
  newStartDate: string;
  newEndDate: string;
  notes?: string;
  renewalType?: 'NORMAL' | 'PRE_RENEWAL';
}

// ── Notifications ──

export interface Notification {
  id: string;
  customerId: string;
  documentId: string;
  customerName: string;
  phoneNumber: string;
  vehicleNumber: string;
  documentType: string;
  originalExpiryDate: string;
  currentExpiryDate: string;
  reminderType: string;
  message: string | null;
  sentDate: string | null;
  sentTime: string | null;
  channel: string;
  deliveryStatus: string;
  notificationStatus: string;
  cancellationReason: string | null;
  createdAt: string;
}

// ── Renewals ──

export interface RenewalHistory {
  id: string;
  customerId: string;
  documentId: string;
  oldDocumentName: string;
  oldStartDate: string;
  oldEndDate: string;
  newStartDate: string;
  newEndDate: string;
  renewalDate: string;
  notes: string | null;
  admin: {
    id: string;
    username: string;
  };
  customer?: {
    id: string;
    firstName: string;
    secondName: string;
    phoneNumber: string;
    vehicleNumber: string;
  };
  document?: {
    id: string;
    documentName: string;
  };
}

// ── Dashboard ──

export interface DashboardStats {
  totalCustomers: number;
  totalDocuments: number;
  expiringSoonCount: number;
  criticalCount: number;
  expiredCount: number;
  notificationsSentToday: number;
  notificationsCancelledAfterRenewal: number;
  totalRenewals: number;
  pendingNotifications: number;
  failedNotifications: number;
}

export interface DashboardFilters {
  documentName?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  dateType?: 'endDate' | 'startDate';
  page?: number;
  limit?: number;
}

export interface FilteredDocument extends DocumentWithStatus {
  customer: {
    id: string;
    firstName: string;
    secondName: string;
    phoneNumber: string;
    vehicleNumber: string;
    remarks?: string | null;
  };
}

export interface RegistrationHistoryItem {
  date: string;
  customers: number;
  documents: number;
  reminders: number;
}

export interface RegistrationHistoryResponse {
  totalCustomers: number;
  totalDocuments: number;
  totalReminders: number;
  history: RegistrationHistoryItem[];
}

// ── Uploaded PDF & Batch Registration ──

export interface EvaluatedCustomerRecord {
  tempId: string;
  firstName: string;
  secondName?: string;
  phoneNumber: string;
  vehicleNumber: string;
  vehicleType?: '2 Wheeler' | '4 Wheeler' | 'Truck';
  documentName?: string;
  startDate?: string;
  endDate?: string;
  drivingLicenceNumber?: string;
  remarks?: string;
  rawText?: string;
  status: 'VALID' | 'DUPLICATE' | 'INVALID';
  statusReason?: string;
  matchedExistingCustomer?: {
    id: string;
    name: string;
    phoneNumber: string;
    vehicleNumber: string;
  };
}

export interface BatchPreviewResponse {
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

export interface BatchConfirmResponse {
  uploadedPdfId: string;
  fileName: string;
  totalFound: number;
  registeredCount: number;
  skippedCount: number;
  invalidCount: number;
  registeredCustomers: Array<{ id: string; name: string; vehicleNumber: string; phoneNumber: string }>;
  skippedCustomers: Array<{ name: string; phone: string; vehicleNumber: string; reason: string }>;
}

export interface UploadedPdfRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalFound: number;
  registeredCount: number;
  skippedCount: number;
  invalidCount: number;
  summaryNotes?: string;
  uploadedByAdminId?: string;
  createdAt: string;
  uploadedByAdmin?: {
    id: string;
    username: string;
  };
  customers?: Array<{
    id: string;
    firstName: string;
    secondName?: string;
    vehicleNumber: string;
  }>;
}

