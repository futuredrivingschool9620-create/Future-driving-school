import { useEffect, useRef } from 'react';
import { getAccessToken } from '../lib/api';

type SSEEvent = {
  type: string;
  message?: string;
  data?: any;
};

/**
 * Custom hook to subscribe to Server-Sent Events (SSE).
 * Automatically handles reconnection and authentication.
 * Uses a ref for the onEvent callback to prevent duplicate connections on component re-renders.
 * 
 * @param onEvent Callback function triggered when a new event arrives.
 */
export function useSSE(onEvent: (event: SSEEvent) => void) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    let isClosed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (isClosed) return;
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
        eventSource = new EventSource(`${API_BASE}/events?token=${token}`, {
          withCredentials: true,
        });

        eventSource.onmessage = (event) => {
          try {
            const parsed: SSEEvent = JSON.parse(event.data);
            if (parsed.type === 'connected') {
              // Connected cleanly
            } else {
              onEventRef.current(parsed);
            }
          } catch {
            // Ignore malformed payloads silently
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Controlled 15s backoff avoids rapid reconnect loop & network jitter
          if (!isClosed && !reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              connect();
            }, 15000);
          }
        };
      } catch {
        // SSE unavailable in this environment; non-blocking
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);
}
