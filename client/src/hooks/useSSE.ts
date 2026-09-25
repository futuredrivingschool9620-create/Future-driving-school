import { useEffect, useRef } from 'react';
import { getAccessToken } from '../lib/api';

export type SSEEvent = {
  type: string;
  message?: string;
  data?: any;
};

type SSEListener = (event: SSEEvent) => void;

class SSEManager {
  private static instance: SSEManager;
  private listeners: Set<SSEListener> = new Set();
  private eventSource: EventSource | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  public subscribe(listener: SSEListener): () => void {
    this.listeners.add(listener);

    // Cancel pending disconnect if a component subscribed during page navigation
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    if (!this.eventSource && !this.reconnectTimeout) {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        // Debounce disconnect by 10s so switching between pages doesn't churn connections
        this.disconnectTimeout = setTimeout(() => {
          if (this.listeners.size === 0) {
            this.disconnect();
          }
        }, 10000);
      }
    };
  }

  private connect(): void {
    const token = getAccessToken();
    if (!token) return;

    const API_BASE =
      typeof window !== 'undefined' &&
      (window.electronAPI?.isElectron ||
        window.location.protocol === 'file:' ||
        !window.location.origin ||
        window.location.origin === 'null')
        ? 'http://localhost:3001/api'
        : import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    try {
      this.eventSource = new EventSource(`${API_BASE}/events?token=${token}`, {
        withCredentials: true,
      });

      this.eventSource.onmessage = (event) => {
        try {
          const parsed: SSEEvent = JSON.parse(event.data);
          if (parsed.type === 'connected') {
            // Connection established
          } else {
            this.listeners.forEach((listener) => {
              try {
                listener(parsed);
              } catch (e) {
                console.error('[SSE] Listener error:', e);
              }
            });
          }
        } catch {
          // Ignore malformed event silently
        }
      };

      this.eventSource.onerror = () => {
        this.disconnect();
        // Controlled 15s backoff avoids rapid reconnect loop
        if (this.listeners.size > 0 && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.listeners.size > 0) {
              this.connect();
            }
          }, 15000);
        }
      };
    } catch {
      // SSE not supported or unavailable
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

/**
 * Custom hook to subscribe to Server-Sent Events (SSE).
 * Uses a singleton manager so all mounted views share one active connection
 * without opening and closing connections on each page navigation.
 */
export function useSSE(onEvent: (event: SSEEvent) => void) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const manager = SSEManager.getInstance();
    const unsubscribe = manager.subscribe((event) => {
      onEventRef.current(event);
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
