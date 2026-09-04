import { env } from '../config/env.js';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * WhatsApp Business API integration-ready service.
 * Currently logs messages when not configured.
 * Configure WHATSAPP_ENABLED=true and provide API credentials to enable.
 */
export class WhatsAppService {
  /**
   * Send a WhatsApp message via the Business API.
   */
  static async sendMessage(phoneNumber: string, message: string): Promise<SendResult> {
    if (!env.WHATSAPP_ENABLED || !env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[WhatsApp] Not configured. Would send to ${phoneNumber}: ${message.substring(0, 80)}...`);
      return { success: false, error: 'WhatsApp not configured' };
    }

    try {
      const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber.replace(/[^0-9]/g, ''),
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[WhatsApp] API error: ${response.status} ${errorBody}`);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json() as { messages?: Array<{ id: string }> };
      const messageId = data.messages?.[0]?.id;

      console.log(`[WhatsApp] Message sent to ${phoneNumber}: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WhatsApp] Send error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send a WhatsApp template message.
   */
  static async sendTemplate(
    phoneNumber: string,
    templateName: string,
    params: string[]
  ): Promise<SendResult> {
    if (!env.WHATSAPP_ENABLED || !env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[WhatsApp] Not configured. Would send template "${templateName}" to ${phoneNumber}`);
      return { success: false, error: 'WhatsApp not configured' };
    }

    try {
      const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber.replace(/[^0-9]/g, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: params.map((p) => ({ type: 'text', text: p })),
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorBody}` };
      }

      const data = await response.json() as { messages?: Array<{ id: string }> };
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }
}
