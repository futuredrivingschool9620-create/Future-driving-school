import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiUrl = 'https://graph.facebook.com/v25.0';
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '') || '';
  
  // Real IDs from the user's WhatsApp Manager screenshot:
  const realPhoneId = '1426657943854134';
  const realWabaId = '1116030660847995';
  const activeTemplateId = '1095764336727114';

  const results: any = {
    realPhoneId,
    realWabaId,
    activeTemplateId,
  };

  // 1. Check Phone Number ID
  try {
    const r = await fetch(`${apiUrl}/${realPhoneId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    results.phone_check = await r.json();
  } catch (e: any) {
    results.phone_check = { error: e.message };
  }

  // 2. Check WABA
  try {
    const r = await fetch(`${apiUrl}/${realWabaId}?fields=id,name,currency,timezone_id`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    results.waba_check = await r.json();
  } catch (e: any) {
    results.waba_check = { error: e.message };
  }

  // 3. Check Templates in this real WABA
  try {
    const r = await fetch(`${apiUrl}/${realWabaId}/message_templates?limit=50`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    results.templates_check = await r.json();
  } catch (e: any) {
    results.templates_check = { error: e.message };
  }

  // 4. Check the specific template directly
  try {
    const r = await fetch(`${apiUrl}/${activeTemplateId}?fields=name,status,language,components`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    results.template_details = await r.json();
  } catch (e: any) {
    results.template_details = { error: e.message };
  }

  return res.status(200).json(results);
}
