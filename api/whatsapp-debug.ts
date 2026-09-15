import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Diagnostic & Template Management endpoint: /api/whatsapp-debug
 * DELETE THIS FILE after setup is complete.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiUrl = (process.env.WHATSAPP_API_URL?.trim() || 'https://graph.facebook.com/v25.0').replace(/\/+$/, '');
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim().replace(/^["']|["']$/g, '') || '';
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '') || '';
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'future_driving_school';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
  const enabled = process.env.WHATSAPP_ENABLED;
  const wabaId = '1070350425583234';

  const results: any = {
    step0_env: {
      WHATSAPP_ENABLED: enabled,
      WHATSAPP_API_URL: apiUrl,
      WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
      WHATSAPP_TEMPLATE_NAME: templateName,
      WHATSAPP_TEMPLATE_LANG: templateLang,
      TOKEN_PREFIX: apiToken ? apiToken.substring(0, 20) + '...' : 'MISSING',
      TOKEN_LENGTH: apiToken?.length || 0,
      TARGET_WABA_ID: wabaId,
    },
  };

  if (!apiToken || !phoneNumberId) {
    results.error = 'Missing token or phone number ID';
    return res.status(200).json(results);
  }

  // Step 1: List existing templates in WABA 1070350425583234
  try {
    const r = await fetch(`${apiUrl}/${wabaId}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    results.step1_existing_templates = d;
  } catch (e: any) {
    results.step1_existing_templates = { error: e.message };
  }

  // Step 2: Auto-create future_driving_school template if it doesn't exist
  const existingTemplates = results.step1_existing_templates?.data || [];
  const hasTemplate = existingTemplates.some((t: any) => t.name === 'future_driving_school');

  if (!hasTemplate || req.query.force === 'true') {
    const templatePayload = {
      name: 'future_driving_school',
      category: 'UTILITY',
      language: 'en_US',
      components: [
        {
          type: 'BODY',
          text: 'Future Driving School – Renewal Reminder\n\nDear {{1}},\n\nThis is a reminder regarding your vehicle {{2}}.\n\nDOCUMENT: {{3}}\nEXPIRY DATE: {{4}}\nDAYS REMAINING: {{5}}\n\nPlease arrange for renewal before the expiry date.\n\nFOR RENEWAL / ASSISTANCE:\nFuture Driving School\n8317370639 / 9620463722\n\nThank you for choosing Future Driving School.',
          example: {
            body_text: [['Rahul Kumar', 'KA09AB1234', 'Insurance', '20 Sep 2026', '15 days']],
          },
        },
        {
          type: 'FOOTER',
          text: 'Future Driving School - RTO 55',
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'PHONE_NUMBER',
              text: 'Call for Renewal',
              phone_number: '+918317370639',
            },
          ],
        },
      ],
    };

    try {
      const createRes = await fetch(`${apiUrl}/${wabaId}/message_templates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });
      results.step2_create_template_result = await createRes.json();
    } catch (e: any) {
      results.step2_create_template_result = { error: e.message };
    }
  } else {
    results.step2_create_template_result = { status: 'already_exists' };
  }

  // Step 3: Re-check templates after creation
  try {
    const r = await fetch(`${apiUrl}/${wabaId}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    results.step3_templates_after_creation = d;
  } catch (e: any) {
    results.step3_templates_after_creation = { error: e.message };
  }

  return res.status(200).json(results);
}
