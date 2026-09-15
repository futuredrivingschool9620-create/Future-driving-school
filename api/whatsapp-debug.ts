import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiUrl = 'https://graph.facebook.com/v25.0';
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '') || '';
  const phoneId = '1426657943854134';
  const testNumber = (req.query.to as string) || '918317370639'; // Admin phone or query param

  const results: any = {
    phoneId,
    testNumber,
  };

  const defaultLogoUrl = 'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/client/public/logo.png';

  // Test combinations of lang and headerImage
  const langs = ['en', 'en_US', 'en_GB'];
  results.tests = {};

  for (const lang of langs) {
    for (const withHeader of [true, false]) {
      const key = `${lang}_header_${withHeader}`;
      try {
        const components: any[] = [];
        if (withHeader) {
          components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: defaultLogoUrl } }],
          });
        }
        components.push({
          type: 'body',
          parameters: [
            { type: 'text', text: 'Charan salanki' },
            { type: 'text', text: 'KA09JP3222' },
            { type: 'text', text: 'Insurance' },
            { type: 'text', text: '20 Sep 2026' },
            { type: 'text', text: '15 days' },
          ],
        });

        const r = await fetch(`${apiUrl}/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: testNumber.replace(/[^0-9]/g, ''),
            type: 'template',
            template: {
              name: 'future_driving_school',
              language: { code: lang },
              components,
            },
          }),
        });

        const d = await r.json();
        results.tests[key] = { status: r.status, data: d };

        if (r.ok) {
          results.SUCCESSFUL_CONFIG = { lang, withHeader, messageId: (d as any).messages?.[0]?.id };
          return res.status(200).json(results);
        }
      } catch (e: any) {
        results.tests[key] = { error: e.message };
      }
    }
  }

  return res.status(200).json(results);
}
