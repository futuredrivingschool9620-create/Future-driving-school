import * as cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { getDaysRemaining, getReminderType, getTodayIST, formatDateIN } from '../utils/dateHelpers.js';
import { NotificationService } from './notification.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import { SmsService } from './sms.service.js';
import type { ReminderType } from '@prisma/client';

export class SchedulerService {
  private static task: cron.ScheduledTask | null = null;

  /**
   * Start the daily expiry check scheduler.
   */
  static start() {
    if (!env.SCHEDULER_ENABLED) {
      console.log('📅 Scheduler disabled via SCHEDULER_ENABLED=false');
      return;
    }

    const cronExpr = env.SCHEDULER_CRON;
    console.log(`📅 Starting expiry check scheduler: ${cronExpr} (${env.TIMEZONE})`);

    this.task = cron.schedule(cronExpr, async () => {
      console.log(`\n🔔 [${new Date().toISOString()}] Running daily expiry check...`);
      try {
        await this.runExpiryCheck();
        console.log('✅ Daily expiry check completed');
      } catch (error) {
        console.error('❌ Scheduler error:', error);
      }
    }, {
      timezone: env.TIMEZONE,
    });

    console.log('✅ Scheduler started');
  }

  /**
   * Stop the scheduler.
   */
  static stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('🛑 Scheduler stopped');
    }
  }

  /**
   * Run expiry check manually (also called by cron).
   */
  static async runExpiryCheck() {
    const today = getTodayIST();

    // Get all active, current documents
    const documents = await prisma.document.findMany({
      where: {
        isActive: true,
        isCurrent: true,
        customer: { isActive: true },
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            secondName: true,
            phoneNumber: true,
            vehicleNumber: true,
            isActive: true,
          },
        },
      },
    });

    let notificationsCreated = 0;
    let notificationsSent = 0;
    let skipped = 0;

    for (const doc of documents) {
      // Skip if customer is inactive
      if (!doc.customer.isActive) {
        skipped++;
        continue;
      }

      const daysRemaining = getDaysRemaining(doc.endDate);
      const reminderTypeStr = getReminderType(daysRemaining);

      // Only process documents that need reminders
      if (!reminderTypeStr) {
        continue;
      }

      const customerName = `${doc.customer.firstName} ${doc.customer.secondName}`;

      // Check for duplicate notification
      const isDuplicate = await NotificationService.isDuplicate(
        doc.customerId,
        doc.id,
        reminderTypeStr as ReminderType,
        doc.endDate,
        today
      );

      if (isDuplicate) {
        skipped++;
        continue;
      }

      // Build notification message
      const message = this.buildMessage(
        customerName,
        doc.documentName,
        doc.customer.vehicleNumber,
        daysRemaining,
        formatDateIN(doc.endDate)
      );

      // Create notification record
      const notification = await NotificationService.createNotification({
        customerId: doc.customerId,
        documentId: doc.id,
        customerName,
        phoneNumber: doc.customer.phoneNumber,
        vehicleNumber: doc.customer.vehicleNumber,
        documentType: doc.documentName,
        originalExpiryDate: doc.endDate,
        currentExpiryDate: doc.endDate,
        reminderType: reminderTypeStr as ReminderType,
        message,
        calendarDay: today,
      });

      if (!notification) {
        skipped++;
        continue;
      }

      notificationsCreated++;

      // Try to send via WhatsApp or SMS
      try {
        let sent = false;

        if (env.WHATSAPP_ENABLED) {
          const result = await WhatsAppService.sendMessage(
            doc.customer.phoneNumber,
            message
          );
          if (result.success) {
            await NotificationService.markSent(notification.id, result.messageId);
            sent = true;
            notificationsSent++;
          }
        }

        if (!sent && env.SMS_ENABLED) {
          const result = await SmsService.sendSMS(
            doc.customer.phoneNumber,
            message
          );
          if (result.success) {
            await NotificationService.markSent(notification.id, result.messageId);
            notificationsSent++;
          }
        }

        // If no provider is enabled, mark as sent (logged only)
        if (!env.WHATSAPP_ENABLED && !env.SMS_ENABLED) {
          await NotificationService.markSent(notification.id, 'local-log');
          notificationsSent++;
          console.log(`  📧 [LOG] ${customerName} | ${doc.documentName} | ${daysRemaining} days | ${reminderTypeStr}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        await NotificationService.markFailed(notification.id, msg);
        console.error(`  ❌ Failed to send notification for ${customerName}: ${msg}`);
      }
    }

    console.log(`  📊 Summary: ${notificationsCreated} created, ${notificationsSent} sent, ${skipped} skipped`);
  }

  /**
   * Build notification message.
   */
  private static buildMessage(
    customerName: string,
    documentType: string,
    vehicleNumber: string,
    daysRemaining: number,
    expiryDate: string
  ): string {
    if (daysRemaining === 0) {
      return `Dear ${customerName}, your ${documentType} for vehicle ${vehicleNumber} expires TODAY (${expiryDate}). Please renew immediately. — Future Driving School`;
    }

    if (daysRemaining === 1) {
      return `Dear ${customerName}, your ${documentType} for vehicle ${vehicleNumber} expires TOMORROW (${expiryDate}). Please renew as soon as possible. — Future Driving School`;
    }

    return `Dear ${customerName}, your ${documentType} for vehicle ${vehicleNumber} will expire in ${daysRemaining} days (${expiryDate}). Please plan for renewal. — Future Driving School`;
  }
}
