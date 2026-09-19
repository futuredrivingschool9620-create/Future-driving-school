import dotenv from 'dotenv';
dotenv.config();

async function checkMeta() {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  console.log('Using Phone ID:', phoneId);
  console.log('Token prefix:', token ? token.substring(0, 20) + '...' : 'NONE');

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}?fields=verified_name,display_phone_number,whatsapp_business_account`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('Phone details response:', JSON.stringify(data, null, 2));

    const wabaId = (data as any).whatsapp_business_account?.id;
    if (wabaId) {
      console.log('Found WABA ID:', wabaId);
      const templatesRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const templatesData = await templatesRes.json();
      console.log('Templates response:', JSON.stringify(templatesData, null, 2));
    }
  } catch (err) {
    console.error('Error querying Meta:', err);
  }
}

checkMeta();
