import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from '../../server/src/lib/prisma.js';
import { WhatsAppService } from '../../server/src/services/whatsapp.service.js';
import { NotificationService } from '../../server/src/services/notification.service.js';
import {
  getTodayIST,
  getDaysRemaining,
  getReminderType,
  formatDateIN,
} from '../../server/src/utils/dateHelpers.js';
import type { ReminderType } from '@prisma/client';

/**
 * Vercel Cron Handler — Insurance Renewal WhatsApp Reminders
 *
 * Schedule: 0 4 * * *  (4:00 AM UTC = 9:30 AM IST, daily)
 *
 * This handler scans all active Insurance documents and fires WhatsApp
 * reminders for documents expiring in exactly 15 days, and again daily
 * during the final 7-day countdown (7 → 0 days).
 *
 * Security: Vercel Cron automatically attaches:
 *   Authorization: Bearer <CRON_SECRET>
 * Set CRON_SECRET in Vercel Dashboard → Settings → Environment Variables.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {

  // ── 1. Security: Reject any request that isn't from Vercel Cron ──────────
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const startTime = Date.now();
  console.log(`\n🔔 [${new Date().toISOString()}] Vercel Cron: insurance-reminders starting...`);

  try {
    const today = getTodayIST();

    // ── 2. Query: All active, current Insurance documents linked to a vehicle ─
    const documents = await prisma.document.findMany({
      where: {
        documentName: 'Insurance',
        isActive: true,
        isCurrent: true,
        vehicleId: { not: null },         // Must be linked to a vehicle
        customer: { isActive: true },
        vehicle:  { isActive: true },
      },
      include: {
        customer: {
          select: {
            id:           true,
            firstName:    true,
            secondName:   true,
            phoneNumber:  true,
            vehicleNumber: true,
            isActive:     true,
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

    // ── 3. Loop: Evaluate each document for a reminder window ─────────────────
    for (const doc of documents) {
      if (!doc.customer || !doc.vehicle) { skipped++; continue; }

      const daysRemaining   = getDaysRemaining(doc.endDate);
      const reminderTypeStr = getReminderType(daysRemaining);   // null if not a reminder day

      // Skip documents that don't fall in a reminder window
      if (!reminderTypeStr) continue;

      const customerName  = `${doc.customer.firstName} ${doc.customer.secondName || ''}`.trim();
      const vehicleNumber = doc.vehicle.vehicleNumber || doc.customer.vehicleNumber || 'N/A';
      const phoneNumber   = doc.customer.phoneNumber;

      // ── 4. Duplicate guard (matches the DB @@unique constraint) ─────────────
      const isDuplicate = await NotificationService.isDuplicate(
        doc.customerId,
        doc.id,
        reminderTypeStr as ReminderType,
        doc.endDate,
        today,
      );

      if (isDuplicate) {
        console.log(`  ⏭  Skip (duplicate): ${customerName} | ${vehicleNumber} | ${reminderTypeStr}`);
        skipped++;
        continue;
      }

      // ── 5. Build plain-text message (used for DB logging / SMS fallback) ───
      const daysStr =
        daysRemaining === 0 ? '0 days (TODAY)'
        : daysRemaining === 1 ? '1 day (TOMORROW)'
        : `${daysRemaining} days`;

      const message = buildMessage(customerName, vehicleNumber, formatDateIN(doc.endDate), daysStr);

      // ── 6. Persist Notification record (status = PENDING) ────────────────────
      const notification = await NotificationService.createNotification({
        customerId:        doc.customerId,
        vehicleId:         doc.vehicleId ?? undefined,
        documentId:        doc.id,
        customerName,
        phoneNumber,
        vehicleNumber,
        documentType:      doc.documentName,
        originalExpiryDate: doc.endDate,
        currentExpiryDate:  doc.endDate,
        reminderType:      reminderTypeStr as ReminderType,
        message,
        calendarDay:       today,
      });

      if (!notification) { skipped++; continue; }   // P2002 duplicate caught inside createNotification
      notificationsCreated++;

      // ── 7. Send WhatsApp template via existing WhatsAppService ───────────────
      //
      // Template: insurance_renewal_reminder
      // Placeholders match Meta template body in this exact order:
      //   {{1}} → Customer full name     e.g. "Ramesh Kumar"
      //   {{2}} → Vehicle number plate   e.g. "KA 55 AB 1234"
      //   {{3}} → Expiry date (readable) e.g. "26 Sep 2026"
      //   {{4}} → Days remaining         e.g. "15 days"
      //
      try {
        const templateParams = [
          customerName,               // {{1}}
          vehicleNumber,              // {{2}}
          formatDateIN(doc.endDate),  // {{3}}
          daysStr,                    // {{4}}
        ];

        const result = await WhatsAppService.sendTemplate(
          phoneNumber,
          'insurance_renewal_reminder',
          templateParams,
        );

        if (result.success) {
          await NotificationService.markSent(notification.id, result.messageId);
          notificationsSent++;
          console.log(`  ✅ Sent  : ${customerName} | ${vehicleNumber} | ${reminderTypeStr} | id:${result.messageId}`);
        } else {
          await NotificationService.markFailed(notification.id, result.error ?? 'WhatsApp send failed');
          errors.push(`${customerName} (${vehicleNumber}): ${result.error}`);
          console.error(`  ❌ Failed: ${customerName} | ${vehicleNumber} | ${result.error}`);
        }
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : 'Unknown send error';
        await NotificationService.markFailed(notification.id, errMsg);
        errors.push(`${customerName} (${vehicleNumber}): ${errMsg}`);
        console.error(`  ❌ Exception: ${customerName} | ${errMsg}`);
      }
    }

    // ── 8. Return structured run summary ─────────────────────────────────────
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(summary));

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Insurance cron fatal error:', errMsg);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: errMsg, runAt: new Date().toISOString() }));
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
