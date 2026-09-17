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

interface TemplateConfig {
  status: 'APPROVED' | 'PENDING' | 'NOT_CONFIGURED';
  templateName: string;
  language: string;
  notice?: string;
}

const WABA_ID = '1070350425583234';

async function getWhatsAppTemplateConfig(preferredTemplate: string): Promise<TemplateConfig> {
  const rawApiUrl = process.env.WHATSAPP_API_URL?.trim() || 'https://graph.facebook.com/v25.0';
  const apiUrl = rawApiUrl.replace(/\/+$/, '');
  const rawPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const phoneNumberId = rawPhoneId.replace(/^["']|["']$/g, '');
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '');
  const enabled = process.env.WHATSAPP_ENABLED === 'true';

  if (!enabled || !apiToken || !phoneNumberId) {
    return {
      status: 'NOT_CONFIGURED',
      templateName: preferredTemplate,
      language: 'en',
      notice: 'WhatsApp is not enabled or credentials are missing.',
    };
  }

  try {
    const res = await fetch(`${apiUrl}/${WABA_ID}/message_templates?limit=50`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    const data = await res.json() as any;

    if (data?.data && Array.isArray(data.data)) {
      const templates = data.data;
      console.log(`[Meta Info] Templates in WABA ${WABA_ID}:`, JSON.stringify(templates.map((t: any) => ({
        name: t.name,
        status: t.status,
        language: t.language,
      }))));

      // 1. Check for APPROVED or ACTIVE template
      const isApproved = (s: string) => s === 'APPROVED' || s === 'ACTIVE';
      const approvedMatch = templates.find((t: any) =>
        isApproved(t.status) && (
          t.name.toLowerCase() === preferredTemplate.toLowerCase() ||
          t.name.toLowerCase().includes('insurance') ||
          t.name.toLowerCase().includes('vehicle') ||
          t.name.toLowerCase().includes('future')
        )
      );

      if (approvedMatch) {
        return {
          status: 'APPROVED',
          templateName: approvedMatch.name,
          language: approvedMatch.language || 'en',
        };
      }

      // 2. Check for PENDING template
      const pendingMatch = templates.find((t: any) =>
        t.status === 'PENDING' && (
          t.name.toLowerCase() === preferredTemplate.toLowerCase() ||
          t.name.toLowerCase().includes('insurance') ||
          t.name.toLowerCase().includes('vehicle') ||
          t.name.toLowerCase().includes('future')
        )
      );

      if (pendingMatch) {
        return {
          status: 'PENDING',
          templateName: pendingMatch.name,
          language: pendingMatch.language || 'en',
          notice: `WhatsApp template "${pendingMatch.name}" is currently PENDING Meta approval. Messages will automatically send once Meta approves it.`,
        };
      }

      return {
        status: 'PENDING',
        templateName: preferredTemplate,
        language: 'en',
        notice: `No matching template found in WABA ${WABA_ID}. Please create and approve a template in Meta WhatsApp Manager.`,
      };
    } else {
      console.warn(`[Meta Info] Could not fetch templates:`, JSON.stringify(data));
    }
  } catch (err) {
    console.warn(`[Meta Info] Template discovery failed:`, err);
  }

  return {
    status: 'APPROVED',
    templateName: preferredTemplate,
    language: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en',
  };
}

async function sendWhatsAppTemplateMessage(
  phoneNumber: string,
  templateName: string,
  language: string,
  params: string[],
): Promise<SendResult> {
  const rawApiUrl = process.env.WHATSAPP_API_URL?.trim() || 'https://graph.facebook.com/v25.0';
  const apiUrl = rawApiUrl.replace(/\/+$/, '');
  const rawPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const phoneNumberId = rawPhoneId.replace(/^["']|["']$/g, '');
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim().replace(/^["']|["']$/g, '');

  const url = `${apiUrl}/${phoneNumberId}/messages`;

  try {
    const components = [
      {
        type: 'body',
        parameters: params.map((p) => ({ type: 'text', text: p })),
      },
    ];

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
          language: { code: language },
          components,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json() as { messages?: Array<{ id: string }> };
      const messageId = data.messages?.[0]?.id;
      console.log(`✅ [WhatsApp] Success! Template "${templateName}" (${language}) sent to ${phoneNumber}. Message ID: ${messageId}`);
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

    const lastError = `API error ${response.status} (Code ${errorCode}): ${errorMessage}`;
    console.error(`[WhatsApp] Send error: ${lastError}`);
    return { success: false, error: lastError };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WhatsApp] Send exception: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
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

    // Discover WhatsApp template once before processing documents
    const templateConfig = await getWhatsAppTemplateConfig(templateName);
    if (templateConfig.status === 'APPROVED') {
      console.log(`🎯 [Meta Info] Using approved template "${templateConfig.templateName}" (lang: "${templateConfig.language}")`);
    } else {
      console.warn(`⚠️ [Meta Info] ${templateConfig.notice}`);
    }

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
        daysRemaining === 0 ? '0 days (TODAY)'
        : daysRemaining === 1 ? '1 day (TOMORROW)'
        : `${daysRemaining} days`;

      const message = buildMessage(customerName, vehicleNumber, formatDateIN(doc.endDate), daysStr);

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

        let result: SendResult;

        if (templateConfig.status === 'PENDING') {
          // Template is pending Meta review; don't hit Meta API which returns 132001
          result = { success: false, error: templateConfig.notice };
        } else if (templateConfig.status === 'NOT_CONFIGURED') {
          result = { success: false, error: 'WhatsApp not configured' };
        } else {
          result = await sendWhatsAppTemplateMessage(
            phoneNumber,
            templateConfig.templateName,
            templateConfig.language,
            templateParams,
          );
        }

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
          const isPending = templateConfig.status === 'PENDING';
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              notificationStatus: isPending ? 'PENDING' : 'FAILED',
              deliveryStatus:     isPending ? 'QUEUED' : 'FAILED',
              cancellationReason: result.error,
            },
          });
          if (isPending) {
            console.log(`  ⏳ Queued (Awaiting Template Approval): ${customerName} | ${vehicleNumber}`);
          } else {
            errors.push(`${customerName} (${vehicleNumber}): ${result.error}`);
            console.error(`  ❌ Failed: ${customerName} | ${vehicleNumber} | ${result.error}`);
          }
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
      whatsappStatus:         templateConfig.status,
      ...(templateConfig.notice && { whatsappNotice: templateConfig.notice }),
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
