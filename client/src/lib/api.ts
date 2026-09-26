import axios from 'axios';
import { logDiagnostic } from './diagnostics';
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

// ── Safe Storage Helpers (prevents crashes under file:// protocol or restricted environments) ──

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {}
  },
};

// ── Token Management ──

const TOKEN_STORAGE_KEY = 'fds_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'fds_refresh_token';

let accessToken: string | null = safeStorage.getItem(TOKEN_STORAGE_KEY) || safeSessionStorage.getItem(TOKEN_STORAGE_KEY);

export function setAccessToken(token: string | null, rememberMe?: boolean) {
  accessToken = token;
  if (token) {
    if (rememberMe) {
      safeStorage.setItem(TOKEN_STORAGE_KEY, token);
      safeSessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      safeSessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      // If rememberMe wasn't explicitly false, keep local storage consistent
      if (rememberMe === undefined && safeStorage.getItem(TOKEN_STORAGE_KEY)) {
        safeStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    }
  } else {
    safeStorage.removeItem(TOKEN_STORAGE_KEY);
    safeSessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = safeStorage.getItem(TOKEN_STORAGE_KEY) || safeSessionStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return accessToken;
}

export function setRefreshToken(token: string | null, rememberMe?: boolean) {
  if (token) {
    if (rememberMe) {
      safeStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
      safeSessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } else if (rememberMe === false) {
      safeSessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
      safeStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } else {
      // Preserve existing storage preference
      if (safeStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)) {
        safeStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
      } else {
        safeSessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
      }
    }
  } else {
    safeStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    safeSessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

export function getRefreshToken(): string | null {
  return safeStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || safeSessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

// ── Session Expiry Broadcasting ──
// When the server *definitively* rejects a refresh token (401/403), the session is dead.
// We must never navigate from inside the interceptor: writing window.location.hash here
// fights React Router and produced an endless '#/login' ⇄ '/' redirect loop (visible as
// flicker on every page switch/submit, eventually leaving a blank white window).
// Instead we clear credentials once, notify the auth layer, and let the router render login.

class MissingSessionError extends Error {
  constructor() {
    super('No refresh token available');
    this.name = 'MissingSessionError';
  }
}

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();
let sessionExpiredLatched = false;

/** Subscribe to "the stored session is no longer valid" events. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** Allow a fresh login to arm session-expiry handling again. */
export function resetSessionExpiredLatch(): void {
  sessionExpiredLatched = false;
}

/**
 * Clears credentials exactly once per expired session and lets the auth provider drop the
 * signed-in admin. A latched one-shot ensures no redirect/navigation storm can ever occur.
 */
function broadcastSessionExpired(): void {
  if (sessionExpiredLatched) return;
  sessionExpiredLatched = true;

  setAccessToken(null);
  setRefreshToken(null);
  invalidateClientCache();

  if (sessionExpiredListeners.size > 0) {
    sessionExpiredListeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('[Auth] session-expired listener error:', e);
      }
    });
    return;
  }

  // Fallback: auth provider not mounted yet (very early boot). Navigate once, never in a loop.
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:' || window.location.hash) {
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    } else if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
}

// Single-flight refresh: concurrent 401s share ONE refresh request. This removes the
// refresh-token rotation race that caused random "session dropout" mid-session.
let refreshPromise: Promise<string> | null = null;

function performTokenRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const storedRefreshToken = getRefreshToken();
      if (!storedRefreshToken) {
        throw new MissingSessionError();
      }
      const { data } = await axios.post<AuthResponse>(
        `${API_BASE}/auth/refresh`,
        { refreshToken: storedRefreshToken },
        { withCredentials: true }
      );
      if (!data?.accessToken) {
        throw new MissingSessionError();
      }
      setAccessToken(data.accessToken);
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** True only when the server explicitly rejected our credentials. */
function isAuthRejection(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

/** True for transient infrastructure problems (DB blip, 5xx, offline) — NOT a logout. */
function isTransientFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === undefined || status === 429 || status >= 500;
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401 with dual-token fallback
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl: string = originalRequest?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await performTokenRefresh();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (refreshError instanceof MissingSessionError || isAuthRejection(refreshError)) {
          // Credentials are genuinely invalid/expired -> end session once, cleanly.
          logDiagnostic({
            category: 'auth',
            endpoint: '/auth/refresh',
            status: 401,
            message: 'Refresh token expired or invalid; requiring user login',
          });
          broadcastSessionExpired();
        } else if (isTransientFailure(refreshError)) {
          // A temporary server/DB/network failure must NEVER log the user out.
          logDiagnostic({
            category: 'api',
            endpoint: '/auth/refresh',
            message: 'Token refresh temporarily unavailable (transient server/database error); session preserved',
          });
        }
        originalRequest._retry = false;
        return Promise.reject(error);
      }
    }

    const status = error.response?.status;
    const url = error.config?.url;
    const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Request failed';
    if (status !== 401 || originalRequest._retry) {
      logDiagnostic({
        category: status === 401 || status === 403 ? 'auth' : 'api',
        endpoint: url,
        status,
        message: errMsg,
      });
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
const MAX_CACHE_ENTRIES = 50; // Bound memory footprint

function pruneMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.timestamp > 120_000) {
      memoryCache.delete(key);
    }
  }
  if (memoryCache.size > MAX_CACHE_ENTRIES) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, memoryCache.size - MAX_CACHE_ENTRIES);
    for (const key of keysToDelete) {
      memoryCache.delete(key);
    }
  }
}

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
      pruneMemoryCache();
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
    setAccessToken(data.accessToken, rememberMe);
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken, rememberMe);
    }
    resetSessionExpiredLatch();
    invalidateClientCache();
    return data;
  },

  refresh: async (): Promise<AuthResponse> => {
    const storedRefreshToken = getRefreshToken();
    const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken: storedRefreshToken });
    setAccessToken(data.accessToken);
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }
    return data;
  },

  logout: async (): Promise<void> => {
    const storedRefreshToken = getRefreshToken();
    try {
      await api.post('/auth/logout', { refreshToken: storedRefreshToken });
    } catch {}
    setAccessToken(null);
    setRefreshToken(null);
    resetSessionExpiredLatch();
    invalidateClientCache();
  },

  changePassword: async (input: ChangePasswordInput): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>('/auth/change-password', input);
    setAccessToken(null);
    setRefreshToken(null);
    resetSessionExpiredLatch();
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

  sendReminder: async (
    id: string,
    docData?: any
  ): Promise<{ success: boolean; message: string; messageId?: string }> => {
    // 1. Resolve document details either from passed object or via API
    let doc = docData;
    if (!doc?.customer?.phoneNumber) {
      try {
        doc = await documentApi.getById(id);
      } catch (err) {
        console.warn('[sendReminder] Could not pre-fetch document:', err);
      }
    }

    const rawPhone = doc?.customer?.phoneNumber;
    if (rawPhone) {
      const customerName = [doc?.customer?.firstName, doc?.customer?.secondName].filter(Boolean).join(' ') || 'Customer';
      const vehicleNumber = doc?.vehicle?.vehicleNumber || doc?.customer?.vehicleNumber || 'Vehicle';
      const documentName = doc?.documentName || 'Document';
      const daysRemaining = typeof doc?.daysRemaining === 'number' ? doc.daysRemaining : 0;
      const daysStr =
        daysRemaining === 0 ? '0 days (TODAY)'
        : daysRemaining === 1 ? '1 day (TOMORROW)'
        : daysRemaining > 1 ? `${daysRemaining} days`
        : `EXPIRED (${Math.abs(daysRemaining)} days ago)`;

      const formattedDate = doc?.endDate
        ? new Date(doc.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

      let cleanPhone = rawPhone.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }

      const WHATSAPP_API_URL = 'https://graph.facebook.com/v25.0';
      const WHATSAPP_PHONE_NUMBER_ID = '1337951776062823';
      const WHATSAPP_API_TOKEN =
        'EAAUurdeulKcBSWjSZC3SNPCSmaFwz8rr2XsQzb9GW3eBv6eZBMabKjHoF8w1I1PGM33lrw9ZCd6KPC4PBQilzAnCnn49ue8nXDHwIjlZC9YqCdNksOZAyGNfNNFozaDg48ZCEpoAYneWEPRyCUGccPPlHZChn6Ihsejz4EHmOGL3XMSszmA8RzaqOpTEDwGrnS1kwZDZD';
      const WHATSAPP_TEMPLATE_NAME = 'future_driving_school';
      const BANNER_URL =
        'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/client/public/whatsapp-banner.png';

      try {
        const metaRes = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: WHATSAPP_TEMPLATE_NAME,
              language: { code: 'en' },
              components: [
                {
                  type: 'header',
                  parameters: [
                    {
                      type: 'image',
                      image: { link: BANNER_URL },
                    },
                  ],
                },
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: customerName },
                    { type: 'text', text: vehicleNumber },
                    { type: 'text', text: documentName },
                    { type: 'text', text: formattedDate },
                    { type: 'text', text: daysStr },
                  ],
                },
              ],
            },
          }),
        });

        if (metaRes.ok) {
          const metaData = (await metaRes.json()) as { messages?: Array<{ id: string }> };
          const messageId = metaData.messages?.[0]?.id;

          // Attempt non-blocking DB log on supporting servers
          try {
            await api.post(`/documents/${id}/log-reminder`, {
              messageId,
              phoneNumber: rawPhone,
            });
          } catch {
            // Silently ignore if running on older local server build
          }

          invalidateClientCache('/notifications');
          invalidateClientCache('/dashboard');
          invalidateClientCache('/documents');

          return {
            success: true,
            message: `✅ WhatsApp reminder sent to ${customerName} (${rawPhone}) with official banner!`,
            messageId,
          };
        } else {
          const errText = await metaRes.text();
          console.error('[sendReminder] Direct Meta WhatsApp error:', metaRes.status, errText);
          throw new Error(`WhatsApp API error: ${metaRes.status} - ${errText}`);
        }
      } catch (directErr: any) {
        console.error('[sendReminder] Direct WhatsApp send failed:', directErr);
        // Fall back to server endpoint only if direct send errored out
        const { data } = await api.post<{ success: boolean; message: string; messageId?: string }>(
          `/documents/${id}/send-reminder`
        );
        invalidateClientCache('/notifications');
        invalidateClientCache('/dashboard');
        return data;
      }
    }

    // Fallback if no phone could be found
    const { data } = await api.post<{ success: boolean; message: string; messageId?: string }>(
      `/documents/${id}/send-reminder`
    );
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

  deleteRange: async (startDate: string, endDate: string, customerId?: string): Promise<{ message: string; count: number }> => {
    const { data } = await api.delete<{ message: string; count: number }>('/renewals/range', {
      data: { startDate, endDate, customerId },
    });
    invalidateClientCache('/renewals');
    return data;
  },

  deleteBatch: async (ids: string[]): Promise<{ message: string; count: number }> => {
    const { data } = await api.delete<{ message: string; count: number }>('/renewals/batch', {
      data: { ids },
    });
    invalidateClientCache('/renewals');
    return data;
  },

  deleteAll: async (): Promise<{ message: string; count: number }> => {
    const { data } = await api.delete<{ message: string; count: number }>('/renewals/all');
    invalidateClientCache('/renewals');
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/renewals/${id}`);
    invalidateClientCache('/renewals');
    return data;
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


