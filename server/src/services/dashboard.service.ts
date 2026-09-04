import { prisma } from '../lib/prisma.js';
import { getDaysRemaining } from '../utils/dateHelpers.js';

export class DashboardService {
  /**
   * Get real-time dashboard statistics from PostgreSQL.
   */
  static async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const fifteenDaysFromNow = new Date(today);
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    const [
      totalCustomers,
      totalDocuments,
      expiringSoonCount,
      criticalCount,
      expiredCount,
      notificationsSentToday,
      notificationsCancelledAfterRenewal,
      totalRenewals,
      pendingNotifications,
      failedNotifications,
    ] = await Promise.all([
      // Total active customers
      prisma.customer.count({ where: { isActive: true } }),

      // Total active current documents
      prisma.document.count({ where: { isActive: true, isCurrent: true, customer: { isActive: true } } }),

      // Documents expiring within 30 days (but not expired)
      prisma.document.count({
        where: {
          isActive: true,
          isCurrent: true,
          customer: { isActive: true },
          endDate: {
            gte: today,
            lte: thirtyDaysFromNow,
          },
        },
      }),

      // Critical: documents expiring within 7 days
      prisma.document.count({
        where: {
          isActive: true,
          isCurrent: true,
          customer: { isActive: true },
          endDate: {
            gte: today,
            lte: sevenDaysFromNow,
          },
        },
      }),

      // Expired documents (endDate < today)
      prisma.document.count({
        where: {
          isActive: true,
          isCurrent: true,
          customer: { isActive: true },
          endDate: { lt: today },
        },
      }),

      // Notifications sent today
      prisma.notification.count({
        where: {
          sentDate: {
            gte: today,
            lt: tomorrow,
          },
          notificationStatus: { in: ['SENT', 'DELIVERED'] },
        },
      }),

      // Notifications cancelled after renewal
      prisma.notification.count({
        where: {
          notificationStatus: 'CANCELLED',
          cancellationReason: { contains: 'renewed' },
        },
      }),

      // Total renewals
      prisma.renewalHistory.count(),

      // Pending notifications
      prisma.notification.count({
        where: { notificationStatus: 'PENDING' },
      }),

      // Failed notifications
      prisma.notification.count({
        where: { notificationStatus: 'FAILED' },
      }),
    ]);

    return {
      totalCustomers,
      totalDocuments,
      expiringSoonCount,
      criticalCount,
      expiredCount,
      notificationsSentToday,
      notificationsCancelledAfterRenewal,
      totalRenewals,
      pendingNotifications,
      failedNotifications,
    };
  }

  /**
   * Get documents that are expiring soon, grouped by urgency.
   */
  static async getExpiringDocuments(limit: number = 50) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const documents = await prisma.document.findMany({
      where: {
        isActive: true,
        isCurrent: true,
        customer: { isActive: true },
        endDate: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        customer: {
          select: { id: true, firstName: true, secondName: true, phoneNumber: true, vehicleNumber: true },
        },
      },
      orderBy: { endDate: 'asc' },
      take: limit,
    });

    return documents.map((doc) => ({
      ...doc,
      daysRemaining: getDaysRemaining(doc.endDate),
      customerName: `${doc.customer.firstName} ${doc.customer.secondName}`,
    }));
  }

  /**
   * Get registration history grouped by date.
   */
  static async getRegistrationHistory(startDate: Date, endDate: Date) {
    // Fetch all customers created in the range
    const customers = await prisma.customer.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { createdAt: true },
    });

    // Fetch all documents created in the range
    const documents = await prisma.document.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { createdAt: true },
    });

    // Fetch all reminders/notifications sent in the range
    const reminders = await prisma.notification.findMany({
      where: {
        sentDate: {
          gte: startDate,
          lte: endDate,
        },
        notificationStatus: { in: ['SENT', 'DELIVERED'] },
      },
      select: { sentDate: true },
    });

    // Group by date (YYYY-MM-DD)
    const historyMap = new Map<string, { date: string; customers: number; documents: number; reminders: number }>();

    const getLocalDateString = (d: Date) => {
      // Return YYYY-MM-DD in local time
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    customers.forEach((c) => {
      const dateStr = getLocalDateString(c.createdAt);
      if (!historyMap.has(dateStr)) {
        historyMap.set(dateStr, { date: dateStr, customers: 0, documents: 0, reminders: 0 });
      }
      historyMap.get(dateStr)!.customers += 1;
    });

    documents.forEach((d) => {
      const dateStr = getLocalDateString(d.createdAt);
      if (!historyMap.has(dateStr)) {
        historyMap.set(dateStr, { date: dateStr, customers: 0, documents: 0, reminders: 0 });
      }
      historyMap.get(dateStr)!.documents += 1;
    });

    reminders.forEach((r) => {
      if (!r.sentDate) return;
      const dateStr = getLocalDateString(r.sentDate);
      if (!historyMap.has(dateStr)) {
        historyMap.set(dateStr, { date: dateStr, customers: 0, documents: 0, reminders: 0 });
      }
      historyMap.get(dateStr)!.reminders += 1;
    });

    // Convert map to sorted array (newest first)
    const history = Array.from(historyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Calculate totals
    const totalCustomers = customers.length;
    const totalDocuments = documents.length;
    const totalReminders = reminders.length;

    return {
      totalCustomers,
      totalDocuments,
      totalReminders,
      history,
    };
  }
}
