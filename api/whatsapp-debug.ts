import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiUrl = 'https://graph.facebook.com/v25.0';
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '') || '';
  const wabaId = '1070350425583234';

  try {
    const r = await fetch(`${apiUrl}/${wabaId}/message_templates?limit=10`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    return res.status(200).json({ wabaId, templates: d });
  } catch (e: any) {
    return res.status(200).json({ error: e.message });
  }
}
