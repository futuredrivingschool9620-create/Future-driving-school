import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

/**
 * Vercel Cron Handler — Insurance Renewal WhatsApp Reminders
 *
 * Schedule: 0 4 * * *  (4:00 AM UTC = 9:30 AM IST, daily)
 *
 * This is a SELF-CONTAINED serverless function. It does NOT import from
 * server/src/ because Vercel compiles each api/ file in isolation.
 * All dependencies (Prisma, WhatsApp fetch, date helpers) are inlined.
 */

// ── Prisma singleton for serverless ───────────────────────────────────────────
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ── Date Helpers (inlined from server/src/utils/dateHelpers.ts) ──────────────

function getTodayIST(): Date {
  // Get current time in IST by formatting and re-parsing
  const now = new Date();
  const istString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "YYYY-MM-DD"
  return new Date(istString + 'T00:00:00.000Z');
}

function getDaysRemaining(endDate: Date): number {
  const today = getTodayIST();
  const expiry = new Date(new Date(endDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00.000Z');
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getReminderType(daysRemaining: number): string | null {
  if (daysRemaining === 15) return 'FIFTEEN_DAY';
  if (daysRemaining === 7) return 'SEVEN_DAY_7';
  if (daysRemaining === 6) return 'SEVEN_DAY_6';
  if (daysRemaining === 5) return 'SEVEN_DAY_5';
  if (daysRemaining === 4) return 'SEVEN_DAY_4';
  if (daysRemaining === 3) return 'SEVEN_DAY_3';
  if (daysRemaining === 2) return 'SEVEN_DAY_2';
  if (daysRemaining === 1) return 'SEVEN_DAY_1';
  if (daysRemaining === 0) return 'EXPIRY_DAY';
  return null;
}

function formatDateIN(date: Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── WhatsApp API (inlined from server/src/services/whatsapp.service.ts) ──────

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendWhatsAppTemplate(
  phoneNumber: string,
  preferredTemplate: string,
  params: string[],
): Promise<SendResult> {
  const rawApiUrl = process.env.WHATSAPP_API_URL?.trim() || 'https://graph.facebook.com/v25.0';
  const apiUrl = rawApiUrl.replace(/\/+$/, '');
  const rawPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const phoneNumberId = rawPhoneId.replace(/^["']|["']$/g, '');
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '');
  const enabled = process.env.WHATSAPP_ENABLED === 'true';

  if (!enabled || !apiToken || !phoneNumberId) {
    console.log(`[WhatsApp] Not configured. Would send template "${preferredTemplate}" to ${phoneNumber}`);
    return { success: false, error: 'WhatsApp not configured' };
  }

  const defaultLogoUrl = 'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/client/public/logo.png';
  const headerImageUrl = process.env.WHATSAPP_HEADER_IMAGE_URL || defaultLogoUrl;

  // Build candidate combinations of (templateName, lang) to be 100% resilient
  const templateNames = Array.from(new Set([
    preferredTemplate,
    'future_driving_school',
    'insurance_renewal_reminder',
  ].filter(Boolean) as string[]));

  const languages = Array.from(new Set([
    process.env.WHATSAPP_TEMPLATE_LANG?.trim(),
    'en',
    'en_US',
  ].filter(Boolean) as string[]));

  const url = `${apiUrl}/${phoneNumberId}/messages`;
  let lastError = '';

  for (const templateName of templateNames) {
    for (const lang of languages) {
      // Try with image header first, and fallback to no header if Meta reports parameter mismatch
      const headerOptions = headerImageUrl ? [true, false] : [false];

      for (const includeHeader of headerOptions) {
        try {
          console.log(`[WhatsApp] Calling API: ${url} (template="${templateName}", lang="${lang}", headerImage=${includeHeader})`);

          const components: any[] = [];
          if (includeHeader && headerImageUrl) {
            components.push({
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: headerImageUrl },
                },
              ],
            });
          }

          // Body parameters: {{1}}, {{2}}, {{3}}, {{4}}, {{5}}
          components.push({
            type: 'body',
            parameters: params.map((p) => ({ type: 'text', text: p })),
          });

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phoneNumber.replace(/[^0-9]/g, ''),
              type: 'template',
              template: {
                name: templateName,
                language: { code: lang },
                components,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json() as { messages?: Array<{ id: string }> };
            const messageId = data.messages?.[0]?.id;
            console.log(`✅ [WhatsApp] Success! Template "${templateName}" (${lang}) sent to ${phoneNumber}. Message ID: ${messageId}`);
            return { success: true, messageId };
          }

          const errorBody = await response.text();
          let errorCode = 0;
          let errorMessage = errorBody;
          try {
            const json = JSON.parse(errorBody);
            errorCode = json.error?.code || 0;
            errorMessage = json.error?.message || errorBody;
          } catch {}

          lastError = `API error ${response.status} (Code ${errorCode}): ${errorMessage}`;
          console.warn(`[WhatsApp] Candidate "${templateName}" [${lang}] failed: ${lastError}`);

          // If error is NOT template/translation missing (132001) or parameter mismatch (132000), abort retries (e.g. auth error)
          if (errorCode !== 132001 && errorCode !== 132000) {
            console.error(`[WhatsApp] Fatal API error: ${lastError}`);
            return { success: false, error: lastError };
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[WhatsApp] Send exception: ${errorMsg}`);
          return { success: false, error: errorMsg };
        }
      }
    }
  }

  return { success: false, error: lastError || 'Failed to send template with all candidate options' };
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {

  // 1. Security: Reject any request that isn't from Vercel Cron
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log(`\n🔔 [${new Date().toISOString()}] Vercel Cron: insurance-reminders starting...`);

  try {
    const today = getTodayIST();
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'future_driving_school';

    // 2. Query: All active, current Insurance documents linked to a vehicle
    const documents = await prisma.document.findMany({
      where: {
        documentName: 'Insurance',
        isActive: true,
        isCurrent: true,
        vehicleId: { not: null },
        customer: { isActive: true },
        vehicle:  { isActive: true },
      },
      include: {
        customer: {
          select: {
            id:            true,
            firstName:     true,
            secondName:    true,
            phoneNumber:   true,
            vehicleNumber: true,
            isActive:      true,
          },
        },
        vehicle: {
          select: {
            id:            true,
            vehicleNumber: true,
            vehicleType:   true,
            isActive:      true,
          },
        },
      },
    });

    let notificationsCreated = 0;
    let notificationsSent    = 0;
    let skipped              = 0;
    const errors: string[]   = [];

    // 3. Loop: Evaluate each document for a reminder window
    for (const doc of documents) {
      if (!doc.customer || !doc.vehicle) { skipped++; continue; }

      const daysRemaining   = getDaysRemaining(doc.endDate);
      const reminderTypeStr = getReminderType(daysRemaining);

      // Skip documents outside a reminder window (15 or 7→0 days)
      if (!reminderTypeStr) continue;

      const customerName  = `${doc.customer.firstName} ${doc.customer.secondName || ''}`.trim();
      const vehicleNumber = doc.vehicle.vehicleNumber || doc.customer.vehicleNumber || 'N/A';
      const phoneNumber   = doc.customer.phoneNumber;

      // 4. Duplicate guard: skip if already successfully sent today
      const existing = await prisma.notification.findFirst({
        where: {
          customerId: doc.customerId,
          documentId: doc.id,
          reminderType: reminderTypeStr as any,
          currentExpiryDate: doc.endDate,
          calendarDay: today,
        },
      });

      if (existing && (existing.notificationStatus === 'SENT' || existing.notificationStatus === 'DELIVERED')) {
        console.log(`  ⏭  Skip (already sent today): ${customerName} | ${vehicleNumber} | ${reminderTypeStr}`);
        skipped++;
        continue;
      }

      // 5. Build plain-text message (stored in DB / SMS fallback)
      const daysStr =
        daysRemaining === 0 ? '0 (TODAY)'
        : daysRemaining === 1 ? '1 (TOMORROW)'
        : `${daysRemaining}`;

      const message = buildMessage(customerName, vehicleNumber, formatDateIN(doc.endDate), daysStr + ' days');

      // 6. Persist or reuse Notification record (PENDING)
      let notification;
      if (existing) {
        // Reuse the existing record (e.g. if previous attempt failed today), resetting to PENDING
        notification = await prisma.notification.update({
          where: { id: existing.id },
          data: {
            notificationStatus: 'PENDING',
            deliveryStatus:     'QUEUED',
            cancellationReason: null,
            message,
          },
        });
      } else {
        try {
          notification = await prisma.notification.create({
            data: {
              customerId:         doc.customerId,
              vehicleId:          doc.vehicleId || null,
              documentId:         doc.id,
              customerName,
              phoneNumber,
              vehicleNumber,
              documentType:       doc.documentName,
              originalExpiryDate: doc.endDate,
              currentExpiryDate:  doc.endDate,
              reminderType:       reminderTypeStr as any,
              message,
              calendarDay:        today,
              notificationStatus: 'PENDING',
              deliveryStatus:     'QUEUED',
            },
          });
        } catch (dbErr: any) {
          // P2002 = unique constraint violation (duplicate)
          if (dbErr?.code === 'P2002') {
            console.log(`  ⏭  Skip (DB duplicate): ${customerName} | ${vehicleNumber}`);
            skipped++;
            continue;
          }
          throw dbErr;
        }
      }

      notificationsCreated++;

      // 7. Send WhatsApp template
      //   {{1}} → Customer full name
      //   {{2}} → Vehicle number plate
      //   {{3}} → Document Name
      //   {{4}} → Expiry date (readable)
      //   {{5}} → Days remaining
      try {
        const templateParams = [
          customerName,
          vehicleNumber,
          doc.documentName || 'Insurance',
          formatDateIN(doc.endDate),
          daysStr,
        ];

        const result = await sendWhatsAppTemplate(phoneNumber, templateName, templateParams);

        if (result.success) {
          const now = new Date();
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              notificationStatus: 'SENT',
              deliveryStatus:     'SENT',
              sentDate:           now,
              sentTime:           now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
              providerMessageId:  result.messageId,
            },
          });
          notificationsSent++;
          console.log(`  ✅ Sent  : ${customerName} | ${vehicleNumber} | ${reminderTypeStr} | id:${result.messageId}`);
        } else {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              notificationStatus: 'FAILED',
              deliveryStatus:     'FAILED',
              cancellationReason: result.error,
            },
          });
          errors.push(`${customerName} (${vehicleNumber}): ${result.error}`);
          console.error(`  ❌ Failed: ${customerName} | ${vehicleNumber} | ${result.error}`);
        }
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : 'Unknown send error';
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            notificationStatus: 'FAILED',
            deliveryStatus:     'FAILED',
            cancellationReason: errMsg,
          },
        });
        errors.push(`${customerName} (${vehicleNumber}): ${errMsg}`);
        console.error(`  ❌ Exception: ${customerName} | ${errMsg}`);
      }
    }

    // 8. Return structured run summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = {
      success:                true,
      runAt:                  new Date().toISOString(),
      elapsedSeconds:         parseFloat(elapsed),
      totalDocumentsScanned:  documents.length,
      notificationsCreated,
      notificationsSent,
      skipped,
      ...(errors.length > 0 && { errors }),
    };

    console.log(`\n📊 Cron summary:`, summary);
    return res.status(200).json(summary);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Insurance cron fatal error:', errMsg);
    return res.status(500).json({ success: false, error: errMsg, runAt: new Date().toISOString() });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Plain-text message body (stored in DB and used as SMS fallback)
// ─────────────────────────────────────────────────────────────────────────────
function buildMessage(
  customerName: string,
  vehicleNumber: string,
  expiryDate: string,
  daysStr: string,
): string {
  return `MD MUBARAK (RTO 55)

Future Driving School – Insurance Renewal Reminder

Dear ${customerName},

This is a reminder regarding your vehicle ${vehicleNumber}.

📄 DOCUMENT: Insurance
📅 EXPIRY DATE: ${expiryDate}
⚠️  DAYS REMAINING: ${daysStr}

Please arrange for renewal before the expiry date to avoid penalties.

📞 FOR RENEWAL / ASSISTANCE:
Future Driving School
8317370659 / 9620463722

Thank you for choosing Future Driving School.`;
}
