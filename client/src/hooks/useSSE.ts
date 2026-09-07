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
    const token = getAccessToken();
    if (!token) return;

    // We can pass token in URL since EventSource doesn't support custom headers easily,
    // or if the backend relies on cookies.
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const eventSource = new EventSource(`${API_BASE}/events?token=${token}`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data);
        if (parsed.type === 'connected') {
          console.log('✅ SSE Connected');
        } else {
          onEventRef.current(parsed);
        }
      } catch (error) {
        console.error('Failed to parse SSE message', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);
}
