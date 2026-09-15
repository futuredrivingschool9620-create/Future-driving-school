import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Diagnostic endpoint: /api/whatsapp-debug
 * 
 * Visit this URL in your browser to see exactly what Meta's API
 * returns for your token, phone number, and templates.
 * 
 * DELETE THIS FILE after debugging is complete.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiUrl = (process.env.WHATSAPP_API_URL?.trim() || 'https://graph.facebook.com/v25.0').replace(/\/+$/, '');
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim().replace(/^["']|["']$/g, '') || '';
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '') || '';
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'future_driving_school';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const enabled = process.env.WHATSAPP_ENABLED;

  const results: any = {
    step0_env_check: {
      WHATSAPP_ENABLED: enabled,
      WHATSAPP_API_URL: apiUrl,
      WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
      WHATSAPP_TEMPLATE_NAME: templateName,
      WHATSAPP_TEMPLATE_LANG: templateLang,
      TOKEN_PREFIX: apiToken ? apiToken.substring(0, 20) + '...' : 'MISSING',
      TOKEN_LENGTH: apiToken?.length || 0,
    },
  };

  if (!apiToken || !phoneNumberId) {
    results.error = 'Missing token or phone number ID in environment variables';
    return res.status(200).json(results);
  }

  // Step 1: Check if the token is valid
  try {
    const meRes = await fetch(`${apiUrl}/me?access_token=${apiToken}`);
    const meData = await meRes.json();
    results.step1_token_check = meData;
  } catch (e: any) {
    results.step1_token_check = { error: e.message };
  }

  // Step 2: Get phone number details (including WABA ID)
  try {
    const phoneRes = await fetch(
      `${apiUrl}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,whatsapp_business_account`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    const phoneData = await phoneRes.json();
    results.step2_phone_details = phoneData;
  } catch (e: any) {
    results.step2_phone_details = { error: e.message };
  }

  // Step 3: If we got a WABA ID, fetch all templates
  const wabaId = results.step2_phone_details?.whatsapp_business_account?.id;
  if (wabaId) {
    try {
      const tplRes = await fetch(
        `${apiUrl}/${wabaId}/message_templates?limit=100`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const tplData = await tplRes.json();

      if (tplData?.data && Array.isArray(tplData.data)) {
        results.step3_all_templates = tplData.data.map((t: any) => ({
          name: t.name,
          status: t.status,
          language: t.language,
          category: t.category,
          id: t.id,
        }));

        // Step 4: Check if our target template exists
        const match = tplData.data.find(
          (t: any) => t.name === templateName
        );
        results.step4_template_match = match
          ? {
              found: true,
              name: match.name,
              status: match.status,
              language: match.language,
              suggestion: `Use WHATSAPP_TEMPLATE_NAME="${match.name}" and WHATSAPP_TEMPLATE_LANG="${match.language}"`,
            }
          : {
              found: false,
              searched_for: templateName,
              available_names: tplData.data.map((t: any) => t.name),
              suggestion: 'The template name you configured does NOT exist in this WABA. Use one of the available_names above.',
            };
      } else {
        results.step3_all_templates = tplData;
      }
    } catch (e: any) {
      results.step3_all_templates = { error: e.message };
    }
  } else {
    results.step3_all_templates = {
      skipped: true,
      reason: 'Could not determine WABA ID from phone number. Check step2 for errors.',
    };
  }

  return res.status(200).json(results);
}
