import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Diagnostic endpoint: /api/whatsapp-debug
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
    step0_env: {
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
    results.error = 'Missing token or phone number ID';
    return res.status(200).json(results);
  }

  // Step 1: Check token validity
  try {
    const r = await fetch(`${apiUrl}/debug_token?input_token=${apiToken}&access_token=${apiToken}`);
    const d = await r.json();
    results.step1_token_debug = d;
  } catch (e: any) {
    results.step1_token_debug = { error: e.message };
  }

  // Step 2: Get phone number basic info (WITHOUT whatsapp_business_account which needs extra perms)
  try {
    const r = await fetch(`${apiUrl}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    results.step2_phone_basic = d;
  } catch (e: any) {
    results.step2_phone_basic = { error: e.message };
  }

  // Step 3: Try to find WABA via different approaches
  const wabaIdsToTry = ['1116030660847995'];
  const businessId = '1546800943437287';

  // 3a: Try business -> owned WABAs
  try {
    const r = await fetch(`${apiUrl}/${businessId}/owned_whatsapp_business_accounts`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    results.step3a_business_wabas = d;
    if (d?.data && Array.isArray(d.data)) {
      for (const waba of d.data) {
        if (waba.id && !wabaIdsToTry.includes(waba.id)) {
          wabaIdsToTry.push(waba.id);
        }
      }
    }
  } catch (e: any) {
    results.step3a_business_wabas = { error: e.message };
  }

  // 3b: Try to find WABA from phone number via a different endpoint
  try {
    const r = await fetch(`${apiUrl}/${phoneNumberId}?fields=id,display_phone_number`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    results.step3b_phone_id_check = d;
  } catch (e: any) {
    results.step3b_phone_id_check = { error: e.message };
  }

  // Step 4: Try fetching templates from each known WABA ID
  results.step4_template_search = {};
  for (const wabaId of wabaIdsToTry) {
    try {
      const r = await fetch(`${apiUrl}/${wabaId}/message_templates?limit=50`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const d = await r.json();
      if (d?.data && Array.isArray(d.data)) {
        results.step4_template_search[wabaId] = {
          success: true,
          templates: d.data.map((t: any) => ({
            name: t.name, status: t.status, language: t.language, id: t.id,
          })),
        };
      } else {
        results.step4_template_search[wabaId] = d;
      }
    } catch (e: any) {
      results.step4_template_search[wabaId] = { error: e.message };
    }
  }

  // Step 5: Try querying the known template ID directly
  const knownTemplateId = '1095764336727114'; // From WhatsApp Manager screenshot
  try {
    const r = await fetch(`${apiUrl}/${knownTemplateId}?fields=name,status,language,components`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const d = await r.json();
    results.step5_direct_template_query = d;
  } catch (e: any) {
    results.step5_direct_template_query = { error: e.message };
  }

  // Step 6: Try sending hello_world template (exists in ALL WABAs) to verify phone number works
  // We send to a dummy number 0000000000 so no real message goes out
  try {
    const r = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '0000000000',
        type: 'template',
        template: { name: 'hello_world', language: { code: 'en_US' } },
      }),
    });
    const d = await r.json();
    results.step6_hello_world_test = d;
  } catch (e: any) {
    results.step6_hello_world_test = { error: e.message };
  }

  // Step 7: Try sending target template to dummy number to check if template exists
  try {
    const r = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '0000000000',
        type: 'template',
        template: { name: templateName, language: { code: 'en_US' } },
      }),
    });
    const d = await r.json();
    results.step7_target_template_test_en_US = d;
  } catch (e: any) {
    results.step7_target_template_test_en_US = { error: e.message };
  }

  try {
    const r = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '0000000000',
        type: 'template',
        template: { name: templateName, language: { code: 'en' } },
      }),
    });
    const d = await r.json();
    results.step7_target_template_test_en = d;
  } catch (e: any) {
    results.step7_target_template_test_en = { error: e.message };
  }

  // Step 8: Summary diagnosis
  const helloWorldErrorCode = results.step6_hello_world_test?.error?.code;
  const targetEnUsErrorCode = results.step7_target_template_test_en_US?.error?.code;
  const targetEnErrorCode = results.step7_target_template_test_en?.error?.code;

  results.step8_diagnosis = {
    token_valid: !results.step1_token_debug?.data?.error,
    phone_verified_name: results.step2_phone_basic?.verified_name || 'UNKNOWN',
    phone_display: results.step2_phone_basic?.display_phone_number || 'UNKNOWN',
    hello_world_works: helloWorldErrorCode !== 132001,
    target_template_en_US_works: targetEnUsErrorCode !== 132001,
    target_template_en_works: targetEnErrorCode !== 132001,
    conclusion: '',
  };

  if (helloWorldErrorCode === 132001) {
    results.step8_diagnosis.conclusion = 'CRITICAL: Even hello_world template fails. Phone number ID may be invalid or in a broken state.';
  } else if (targetEnUsErrorCode !== 132001 || targetEnErrorCode !== 132001) {
    const workingLang = targetEnUsErrorCode !== 132001 ? 'en_US' : 'en';
    results.step8_diagnosis.conclusion = `Template "${templateName}" EXISTS with lang "${workingLang}". The previous failures were due to wrong language code. Fix: Set WHATSAPP_TEMPLATE_LANG=${workingLang}`;
  } else {
    results.step8_diagnosis.conclusion = `Template "${templateName}" does NOT exist in this phone number's WABA, but hello_world does. The template was created in a DIFFERENT WhatsApp Business Account than the phone number belongs to. You need to either: (1) create the template in the same WABA as the phone number, or (2) use the correct phone number ID from the WABA where the template exists.`;
  }

  return res.status(200).json(results);
}
