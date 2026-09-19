import dotenv from 'dotenv';
dotenv.config();

/**
 * Creates the future_driving_school template in WABA 1070350425583234 via the Graph API.
 * Run with: npx tsx scripts/create-template.ts
 */
async function createTemplate() {
  const apiUrl = 'https://graph.facebook.com/v25.0';
  const wabaId = '1070350425583234';
  const token = process.env.WHATSAPP_API_TOKEN?.trim();

  if (!token) {
    console.error('Missing WHATSAPP_API_TOKEN in .env');
    process.exit(1);
  }

  // First update the local .env token with the Vercel production token
  console.log('Token prefix:', token.substring(0, 20) + '...');
  console.log(`Creating template "future_driving_school" in WABA ${wabaId}...`);

  const templateBody = {
    name: 'future_driving_school',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'BODY',
        text: '*Future Driving School – Renewal Reminder*\n\nDear {{1}},\n\nThis is a reminder regarding your vehicle {{2}}.\n\n📄 DOCUMENT: {{3}}\n📅 EXPIRY DATE: {{4}}\n⏰ DAYS REMAINING: {{5}}\n\nPlease arrange for renewal before the expiry date.\n\n📞 FOR RENEWAL / ASSISTANCE:\nFuture Driving School\n8317370639 / 9620463722\n\nThank you for choosing Future Driving School.',
        example: {
          body_text: [['Rahul Kumar', 'KA09AB1234', 'Insurance', '20 September 2026', '15 days']],
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
    const response = await fetch(`${apiUrl}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateBody),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Template created successfully!');
      console.log('Template ID:', (data as any).id);
      console.log('Status:', (data as any).status);
      console.log('\nThe template will be auto-approved shortly (usually instant for Utility templates).');
      console.log('Then run the cron job again to send the WhatsApp reminder!');
    } else {
      console.error('❌ Failed to create template:');
      console.error(JSON.stringify(data, null, 2));
      
      // If duplicate name error, the template might already exist
      if ((data as any)?.error?.code === 2388023) {
        console.log('\nThe template might already exist! Checking...');
        const checkRes = await fetch(`${apiUrl}/${wabaId}/message_templates?name=future_driving_school`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const checkData = await checkRes.json() as any;
        if (checkData?.data?.length > 0) {
          console.log('Found existing template:', JSON.stringify(checkData.data[0], null, 2));
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

createTemplate();
