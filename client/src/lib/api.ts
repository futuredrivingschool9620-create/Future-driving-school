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
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Token Management ──

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API ──

export const authApi = {
  login: async (username: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { username, password, rememberMe });
    setAccessToken(data.accessToken);
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
  },

  changePassword: async (input: ChangePasswordInput): Promise<{ message: string }> => {
    const { data } = await api.put<{ message: string }>('/auth/change-password', input);
    setAccessToken(null);
    return data;
  },

  getProfile: async (): Promise<AdminProfile> => {
    const { data } = await api.get<AdminProfile>('/admin/me');
    return data;
  },
};

// ── Customer API ──

export const customerApi = {
  getAll: async (page = 1, limit = 20): Promise<PaginatedResponse<Customer>> => {
    const { data } = await api.get<PaginatedResponse<Customer>>('/customers', {
      params: { page, limit },
    });
    return data;
  },

  getById: async (id: string): Promise<Customer> => {
    const { data } = await api.get<Customer>(`/customers/${id}`);
    return data;
  },

  create: async (input: CreateCustomerInput): Promise<Customer> => {
    const { data } = await api.post<Customer>('/customers', input);
    return data;
  },

  update: async (id: string, input: UpdateCustomerInput): Promise<Customer> => {
    const { data } = await api.put<Customer>(`/customers/${id}`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },

  search: async (query: string, page = 1, limit = 20): Promise<PaginatedResponse<Customer>> => {
    const { data } = await api.get<PaginatedResponse<Customer>>('/admin/search', {
      params: { q: query, page, limit },
    });
    return data;
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
    return data;
  },

  getById: async (id: string): Promise<Vehicle> => {
    const { data } = await api.get<Vehicle>(`/vehicles/${id}`);
    return data;
  },

  getByCustomerId: async (customerId: string): Promise<Vehicle[]> => {
    const { data } = await api.get<Vehicle[]>(`/customers/${customerId}/vehicles`);
    return data;
  },

  update: async (id: string, input: Partial<VehicleItemInput> & { isActive?: boolean }): Promise<Vehicle> => {
    const { data } = await api.put<Vehicle>(`/vehicles/${id}`, input);
    return data;
  },

  updateStatus: async (id: string, input: { status?: string; isActive?: boolean }): Promise<Vehicle> => {
    const { data } = await api.patch<Vehicle>(`/vehicles/${id}/status`, input);
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/vehicles/${id}`);
    return data;
  },

  addDocument: async (vehicleId: string, input: CreateDocumentInput): Promise<DocumentWithStatus> => {
    const { data } = await api.post<DocumentWithStatus>(`/vehicles/${vehicleId}/documents`, input);
    return data;
  },
};

// ── Document API ──

export const documentApi = {
  getCustomerDocuments: async (customerId: string, page = 1, limit = 20): Promise<PaginatedResponse<DocumentHistoryItem>> => {
    const { data } = await api.get<PaginatedResponse<DocumentHistoryItem>>(`/documents/customer/${customerId}`, {
      params: { page, limit },
    });
    return data;
  },

  getById: async (id: string): Promise<DocumentHistoryItem> => {
    const { data } = await api.get<DocumentHistoryItem>(`/documents/${id}`);
    return data;
  },

  create: async (customerId: string, input: CreateDocumentInput): Promise<DocumentWithStatus> => {
    const { data } = await api.post<DocumentWithStatus>(`/documents/customer/${customerId}`, input);
    return data;
  },

  update: async (id: string, input: { documentName?: string; notes?: string }): Promise<DocumentWithStatus> => {
    const { data } = await api.put<DocumentWithStatus>(`/documents/${id}`, input);
    return data;
  },

  renew: async (id: string, input: RenewDocumentInput): Promise<DocumentWithStatus> => {
    const { data } = await api.post<DocumentWithStatus>(`/documents/${id}/renew`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },

  filter: async (filters: DashboardFilters): Promise<PaginatedResponse<FilteredDocument>> => {
    const { data } = await api.get<PaginatedResponse<FilteredDocument>>('/documents', {
      params: filters,
    });
    return data;
  },

  getUploadedPdfs: async (page = 1, limit = 20): Promise<PaginatedResponse<UploadedPdfRecord>> => {
    const { data } = await api.get<PaginatedResponse<UploadedPdfRecord>>('/documents/uploaded-pdfs', {
      params: { page, limit },
    });
    return data;
  },

  getUploadedPdfDownloadUrl: (id: string): string => {
    return `${API_BASE}/documents/uploaded-pdfs/${id}/download`;
  },
};

// ── Notification API ──

export const notificationApi = {
  getHistory: async (params: { customerId?: string; documentId?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> => {
    const { data } = await api.get<PaginatedResponse<Notification>>('/notifications', { params });
    return data;
  },

  getActivityFeed: async (limit = 20): Promise<Notification[]> => {
    const { data } = await api.get<Notification[]>('/notifications/activity', { params: { limit } });
    return data;
  },
};

// ── Renewal API ──

export const renewalApi = {
  getAll: async (page = 1, limit = 20): Promise<PaginatedResponse<RenewalHistory>> => {
    const { data } = await api.get<PaginatedResponse<RenewalHistory>>('/renewals', { params: { page, limit } });
    return data;
  },

  getForDocument: async (documentId: string, page = 1, limit = 20): Promise<PaginatedResponse<RenewalHistory>> => {
    const { data } = await api.get<PaginatedResponse<RenewalHistory>>(`/renewals/document/${documentId}`, { params: { page, limit } });
    return data;
  },

  getForCustomer: async (customerId: string, page = 1, limit = 20): Promise<PaginatedResponse<RenewalHistory>> => {
    const { data } = await api.get<PaginatedResponse<RenewalHistory>>(`/renewals/customer/${customerId}`, { params: { page, limit } });
    return data;
  },
};

// ── Dashboard API ──

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/dashboard/stats');
    return data;
  },

  getExpiringDocuments: async (limit = 50): Promise<FilteredDocument[]> => {
    const { data } = await api.get<FilteredDocument[]>('/dashboard/expiring', { params: { limit } });
    return data;
  },

  getPreRenewalDocuments: async (limit = 50): Promise<FilteredDocument[]> => {
    const { data } = await api.get<FilteredDocument[]>('/dashboard/pre-renewal', { params: { limit } });
    return data;
  },

  triggerCheck: async (): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/dashboard/trigger-check');
    return data;
  },

  getRegistrationHistory: async (startDate?: string, endDate?: string): Promise<RegistrationHistoryResponse> => {
    const { data } = await api.get<RegistrationHistoryResponse>('/dashboard/registrations', {
      params: { startDate, endDate },
    });
    return data;
  },
};

export default api;
