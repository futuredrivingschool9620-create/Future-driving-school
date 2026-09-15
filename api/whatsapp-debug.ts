import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiUrl = (process.env.WHATSAPP_API_URL?.trim() || 'https://graph.facebook.com/v25.0').replace(/\/+$/, '');
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim().replace(/^["']|["']$/g, '') || '1337951776062823';
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '') || '';
  const wabaId = '1070350425583234';

  const results: any = {
    configured: {
      phoneNumberId,
      wabaId,
      hasToken: Boolean(apiToken),
    },
  };

  // 1. Phone status
  try {
    const r = await fetch(`${apiUrl}/${phoneNumberId}?fields=id,verified_name,display_phone_number,status,quality_rating`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    results.phone = await r.json();
  } catch (e: any) {
    results.phone = { error: e.message };
  }

  // 2. Templates in WABA 1070350425583234
  try {
    const r = await fetch(`${apiUrl}/${wabaId}/message_templates?limit=10`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    results.templates = await r.json();
  } catch (e: any) {
    results.templates = { error: e.message };
  }

  return res.status(200).json(results);
}
