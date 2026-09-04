import { env } from '../config/env.js';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * SMS Gateway integration-ready service.
 * Currently logs messages when not configured.
 * Configure SMS_ENABLED=true and provide API credentials to enable.
 */
export class SmsService {
  /**
   * Send an SMS message via the configured gateway.
   */
  static async sendSMS(phoneNumber: string, message: string): Promise<SendResult> {
    if (!env.SMS_ENABLED || !env.SMS_API_KEY || !env.SMS_API_URL) {
      console.log(`[SMS] Not configured. Would send to ${phoneNumber}: ${message.substring(0, 80)}...`);
      return { success: false, error: 'SMS not configured' };
    }

    try {
      const response = await fetch(env.SMS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SMS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phoneNumber.replace(/[^0-9]/g, ''),
          message,
          sender_id: env.SMS_SENDER_ID || 'FUTDRS',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[SMS] API error: ${response.status} ${errorBody}`);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json() as { message_id?: string; id?: string };
      const messageId = data.message_id || data.id || 'unknown';

      console.log(`[SMS] Message sent to ${phoneNumber}: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SMS] Send error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}
