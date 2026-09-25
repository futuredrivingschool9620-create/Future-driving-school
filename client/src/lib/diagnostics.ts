import { safeStorage } from './api';

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  category: 'api' | 'auth' | 'render' | 'memory' | 'unhandled' | 'lifecycle';
  message: string;
  page?: string;
  component?: string;
  endpoint?: string;
  status?: number;
  memoryMb?: number;
  details?: string;
}

const STORAGE_KEY = 'fds_diagnostics';
const MAX_LOG_ENTRIES = 100;

function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    // Mask JWT/Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+/g, '[JWT_REDACTED]')
    // Mask passwords
    .replace(/"password":\s*"[^"]+"/gi, '"password":"[REDACTED]"')
    .replace(/password=[^&\s]+/gi, 'password=[REDACTED]')
    // Mask Indian phone numbers (10 digits starting with 6-9)
    .replace(/\b[6-9]\d{9}\b/g, '[PHONE_REDACTED]');
}

export function logDiagnostic(entry: {
  category: DiagnosticLogEntry['category'];
  message: string;
  component?: string;
  endpoint?: string;
  status?: number;
  details?: any;
}): void {
  try {
    const memory = (performance as any)?.memory;
    const memoryMb = memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : undefined;
    const page = typeof window !== 'undefined' ? window.location.hash || window.location.pathname : 'unknown';

    let detailsStr: string | undefined = undefined;
    if (entry.details) {
      if (typeof entry.details === 'string') {
        detailsStr = sanitizeText(entry.details);
      } else {
        try {
          detailsStr = sanitizeText(JSON.stringify(entry.details));
        } catch {
          detailsStr = String(entry.details);
        }
      }
    }

    const logItem: DiagnosticLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      category: entry.category,
      message: sanitizeText(entry.message),
      page,
      component: entry.component,
      endpoint: entry.endpoint,
      status: entry.status,
      memoryMb,
      details: detailsStr,
    };

    // Console output for local dev
    console.warn(`[DIAGNOSTICS] [${logItem.category.toUpperCase()}] ${logItem.message}`, {
      status: logItem.status,
      endpoint: logItem.endpoint,
      page: logItem.page,
      memoryMb: logItem.memoryMb,
    });

    // Store in ring-buffer
    const raw = safeStorage.getItem(STORAGE_KEY);
    let logs: DiagnosticLogEntry[] = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }

    logs.unshift(logItem);
    if (logs.length > MAX_LOG_ENTRIES) {
      logs = logs.slice(0, MAX_LOG_ENTRIES);
    }
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

    // Relay to backend non-blockingly
    const apiBase =
      typeof window !== 'undefined' &&
      (window.electronAPI?.isElectron ||
        window.location.protocol === 'file:' ||
        !window.location.origin ||
        window.location.origin === 'null')
        ? 'http://localhost:3001/api'
        : (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

    fetch(`${apiBase}/diagnostics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logItem),
    }).catch(() => {
      // Ignore network errors when dispatching diagnostics
    });
  } catch {
    // Failsafe: logger must never throw
  }
}

export function getDiagnosticLogs(): DiagnosticLogEntry[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDiagnosticLogs(): void {
  safeStorage.removeItem(STORAGE_KEY);
}

// Background memory guard
if (typeof window !== 'undefined') {
  setInterval(() => {
    try {
      const memory = (performance as any)?.memory;
      if (memory && memory.usedJSHeapSize && memory.jsHeapSizeLimit) {
        const ratio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (ratio > 0.85) {
          logDiagnostic({
            category: 'memory',
            message: `High JS Heap memory pressure: ${Math.round(ratio * 100)}% (${Math.round(memory.usedJSHeapSize / 1048576)}MB / ${Math.round(memory.jsHeapSizeLimit / 1048576)}MB)`,
          });
        }
      }
    } catch {}
  }, 60000);
}
