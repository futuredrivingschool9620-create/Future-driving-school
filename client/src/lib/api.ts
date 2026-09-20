import axios from 'axios';
import type {
  AuthResponse,
  AdminProfile,
  Customer,
  PaginatedResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateDocumentInput,
  RenewDocumentInput,
  DocumentWithStatus,
  DocumentHistoryItem,
  DashboardFilters,
  FilteredDocument,
  ChangePasswordInput,
  DashboardStats,
  Notification,
  RenewalHistory,
  RegistrationHistoryResponse,
  BatchPreviewResponse,
  ConfirmBatchPayload,
  BatchConfirmResponse,
  UploadedPdfRecord,
  Vehicle,
  VehicleItemInput,
  AppVersionInfo,
} from '../types';

const getApiBase = () => {
  if (
    typeof window !== 'undefined' &&
    (window.electronAPI?.isElectron ||
      window.location.protocol === 'file:' ||
      !window.location.origin ||
      window.location.origin === 'null')
  ) {
    return 'http://localhost:3001/api';
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
};

const API_BASE = getApiBase();

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Token Management ──

const TOKEN_STORAGE_KEY = 'fds_access_token';

let accessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return accessToken;
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post<AuthResponse>(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — clear token, user needs to re-login
        setAccessToken(null);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ── In-Memory Client Cache & In-Flight Request Deduplication ──

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const DEFAULT_CACHE_TTL_MS = 60_000; // 60 seconds default TTL

export function invalidateClientCache(urlPattern?: string | RegExp) {
  if (!urlPattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (typeof urlPattern === 'string' ? key.includes(urlPattern) : urlPattern.test(key)) {
      memoryCache.delete(key);
    }
  }
}

export async function cachedGet<T>(
  url: string,
  params?: Record<string, any>,
  ttlMs: number = DEFAULT_CACHE_TTL_MS
): Promise<T> {
  // Sort params for consistent cache keys
  let queryString = '';
  if (params && Object.keys(params).length > 0) {
    const cleanParams: Record<string, string> = {};
    Object.keys(params)
      .sort()
      .forEach((k) => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
          cleanParams[k] = String(params[k]);
        }
      });
    queryString = '?' + new URLSearchParams(cleanParams).toString();
  }

  const cacheKey = `${url}${queryString}`;

  // Check valid in-memory cache
  const cached = memoryCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  // Deduplicate identical in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const { data } = await api.get<T>(url, { params });
      memoryCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

// ── Auth API ──

export const authApi = {
  login: async (username: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { username, password, rememberMe });
    setAccessToken(data.accessToken);
    invalidateClientCache();
    return data;
  },

  refresh: async (): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/refresh');
    setAccessToken(data.accessToken);
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    setAccessToken(null);
    invalidateClientCache();
  },

  changePassword: async (input: ChangePasswordInput): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>('/auth/change-password', input);
    setAccessToken(null);
    invalidateClientCache();
    return data;
  },

  getProfile: async (): Promise<AdminProfile> => {
    return cachedGet<AdminProfile>('/admin/me', undefined, 120_000);
  },
};

// ── Customer API ──

export const customerApi = {
  getAll: async (page = 1, limit = 20): Promise<PaginatedResponse<Customer>> => {
    return cachedGet<PaginatedResponse<Customer>>('/customers', { page, limit });
  },

  getById: async (id: string): Promise<Customer> => {
    return cachedGet<Customer>(`/customers/${id}`);
  },

  create: async (input: CreateCustomerInput): Promise<Customer> => {
    const { data } = await api.post<Customer>('/customers', input);
    invalidateClientCache('/customers');
    invalidateClientCache('/admin/search');
    invalidateClientCache('/dashboard');
    return data;
  },

  update: async (id: string, input: UpdateCustomerInput): Promise<Customer> => {
    const { data } = await api.put<Customer>(`/customers/${id}`, input);
    invalidateClientCache('/customers');
    invalidateClientCache(`/customers/${id}`);
    invalidateClientCache('/admin/search');
    invalidateClientCache('/dashboard');
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/customers/${id}`);
    invalidateClientCache('/customers');
    invalidateClientCache(`/customers/${id}`);
    invalidateClientCache('/admin/search');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/documents');
  },

  search: async (query: string, page = 1, limit = 20): Promise<PaginatedResponse<Customer>> => {
    return cachedGet<PaginatedResponse<Customer>>('/admin/search', { q: query, page, limit }, 30_000);
  },

  checkPhone: async (
    phone: string,
    excludeId?: string
  ): Promise<{
    exists: boolean;
    message: string;
    customer?: {
      id: string;
      name: string;
      phoneNumber: string;
      vehicles: Array<{ vehicleNumber: string; vehicleType: string }>;
    };
  }> => {
    const { data } = await api.get(`/customers/check-phone/${encodeURIComponent(phone)}`, {
      params: excludeId ? { excludeId } : undefined,
    });
    return data;
  },

  previewPdfBatch: async (fileName: string, fileBase64: string): Promise<BatchPreviewResponse> => {
    const { data } = await api.post<BatchPreviewResponse>('/customers/upload-pdf/preview', {
      fileName,
      fileBase64,
    });
    return data;
  },

  confirmPdfBatch: async (payload: ConfirmBatchPayload): Promise<BatchConfirmResponse> => {
    const { data } = await api.post<BatchConfirmResponse>('/customers/upload-pdf/confirm', payload);
    invalidateClientCache('/customers');
    invalidateClientCache('/admin/search');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/documents');
    return data;
  },

  downloadSamplePdf: async (): Promise<Blob> => {
    const response = await api.get('/customers/upload-pdf/sample', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ── Vehicle API ──

export const vehicleApi = {
  create: async (customerId: string, input: VehicleItemInput): Promise<Vehicle> => {
    const { data } = await api.post<Vehicle>(`/customers/${customerId}/vehicles`, input);
    invalidateClientCache('/customers');
    invalidateClientCache(`/customers/${customerId}`);
    invalidateClientCache('/dashboard');
    return data;
  },

  getById: async (id: string): Promise<Vehicle> => {
    return cachedGet<Vehicle>(`/vehicles/${id}`);
  },

  getByCustomerId: async (customerId: string): Promise<Vehicle[]> => {
    return cachedGet<Vehicle[]>(`/customers/${customerId}/vehicles`);
  },

  update: async (id: string, input: Partial<VehicleItemInput> & { isActive?: boolean }): Promise<Vehicle> => {
    const { data } = await api.put<Vehicle>(`/vehicles/${id}`, input);
    invalidateClientCache('/customers');
    invalidateClientCache('/vehicles');
    invalidateClientCache('/dashboard');
    return data;
  },

  updateStatus: async (id: string, input: { status?: string; isActive?: boolean }): Promise<Vehicle> => {
    const { data } = await api.patch<Vehicle>(`/vehicles/${id}/status`, input);
    invalidateClientCache('/customers');
    invalidateClientCache('/vehicles');
    invalidateClientCache('/dashboard');
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/vehicles/${id}`);
    invalidateClientCache('/customers');
    invalidateClientCache('/vehicles');
    invalidateClientCache('/dashboard');
    return data;
  },

  addDocument: async (vehicleId: string, input: CreateDocumentInput): Promise<DocumentWithStatus> => {
    const { data } = await api.post<DocumentWithStatus>(`/vehicles/${vehicleId}/documents`, input);
    invalidateClientCache('/customers');
    invalidateClientCache('/documents');
    invalidateClientCache('/dashboard');
    return data;
  },
};

// ── Document API ──

export const documentApi = {
  getCustomerDocuments: async (customerId: string, page = 1, limit = 20): Promise<PaginatedResponse<DocumentHistoryItem>> => {
    return cachedGet<PaginatedResponse<DocumentHistoryItem>>(`/documents/customer/${customerId}`, { page, limit });
  },

  getById: async (id: string): Promise<DocumentHistoryItem> => {
    return cachedGet<DocumentHistoryItem>(`/documents/${id}`);
  },

  create: async (customerId: string, input: CreateDocumentInput): Promise<DocumentWithStatus> => {
    const { data } = await api.post<DocumentWithStatus>(`/documents/customer/${customerId}`, input);
    invalidateClientCache('/documents');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/customers');
    return data;
  },

  update: async (id: string, input: { documentName?: string; notes?: string }): Promise<DocumentWithStatus> => {
    const { data } = await api.put<DocumentWithStatus>(`/documents/${id}`, input);
    invalidateClientCache('/documents');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/customers');
    return data;
  },

  renew: async (id: string, input: RenewDocumentInput): Promise<DocumentWithStatus> => {
    const { data } = await api.post<DocumentWithStatus>(`/documents/${id}/renew`, input);
    invalidateClientCache('/documents');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/renewals');
    invalidateClientCache('/customers');
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
    invalidateClientCache('/documents');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/customers');
  },

  filter: async (filters: DashboardFilters): Promise<PaginatedResponse<FilteredDocument>> => {
    return cachedGet<PaginatedResponse<FilteredDocument>>('/documents', filters);
  },

  getUploadedPdfs: async (page = 1, limit = 20): Promise<PaginatedResponse<UploadedPdfRecord>> => {
    return cachedGet<PaginatedResponse<UploadedPdfRecord>>('/documents/uploaded-pdfs', { page, limit });
  },

  getUploadedPdfDownloadUrl: (id: string): string => {
    return `${API_BASE}/documents/uploaded-pdfs/${id}/download`;
  },

  sendReminder: async (id: string): Promise<{ success: boolean; message: string; messageId?: string }> => {
    const { data } = await api.post<{ success: boolean; message: string; messageId?: string }>(`/documents/${id}/send-reminder`);
    invalidateClientCache('/notifications');
    invalidateClientCache('/dashboard');
    return data;
  },
};

// ── Notification API ──

export const notificationApi = {
  getHistory: async (params: { customerId?: string; documentId?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> => {
    return cachedGet<PaginatedResponse<Notification>>('/notifications', params);
  },

  getActivityFeed: async (limit = 20): Promise<Notification[]> => {
    return cachedGet<Notification[]>('/notifications/activity', { limit });
  },
};

// ── Renewal API ──

export const renewalApi = {
  getAll: async (page = 1, limit = 20): Promise<PaginatedResponse<RenewalHistory>> => {
    return cachedGet<PaginatedResponse<RenewalHistory>>('/renewals', { page, limit });
  },

  getForDocument: async (documentId: string, page = 1, limit = 20): Promise<PaginatedResponse<RenewalHistory>> => {
    return cachedGet<PaginatedResponse<RenewalHistory>>(`/renewals/document/${documentId}`, { page, limit });
  },

  getForCustomer: async (customerId: string, page = 1, limit = 20): Promise<PaginatedResponse<RenewalHistory>> => {
    return cachedGet<PaginatedResponse<RenewalHistory>>(`/renewals/customer/${customerId}`, { page, limit });
  },
};

// ── Dashboard API ──

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return cachedGet<DashboardStats>('/dashboard/stats', undefined, 20_000);
  },

  getExpiringDocuments: async (limit = 50): Promise<FilteredDocument[]> => {
    return cachedGet<FilteredDocument[]>('/dashboard/expiring', { limit }, 20_000);
  },

  getPreRenewalDocuments: async (limit = 50): Promise<FilteredDocument[]> => {
    return cachedGet<FilteredDocument[]>('/dashboard/pre-renewal', { limit }, 20_000);
  },

  triggerCheck: async (): Promise<{
    message: string;
    totalDocumentsScanned?: number;
    notificationsCreated?: number;
    notificationsSent?: number;
    skipped?: number;
  }> => {
    const { data } = await api.post('/dashboard/trigger-check');
    invalidateClientCache('/dashboard');
    invalidateClientCache('/notifications');
    invalidateClientCache('/documents');
    return data;
  },

  getRegistrationHistory: async (startDate?: string, endDate?: string): Promise<RegistrationHistoryResponse> => {
    return cachedGet<RegistrationHistoryResponse>('/dashboard/registrations', { startDate, endDate }, 60_000);
  },
};

// ── App Version & Updates API ──

export const appApi = {
  getVersionInfo: async (clientVersion?: string): Promise<AppVersionInfo> => {
    const { data } = await api.get<AppVersionInfo>('/app/version', {
      params: clientVersion ? { clientVersion } : undefined,
    });
    return data;
  },

  updateVersionInfo: async (payload: Partial<AppVersionInfo>): Promise<{ message: string; info: AppVersionInfo }> => {
    const { data } = await api.post<{ message: string; info: AppVersionInfo }>('/app/version', payload);
    return data;
  },
};

export default api;


