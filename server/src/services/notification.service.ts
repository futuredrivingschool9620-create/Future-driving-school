import { prisma } from '../lib/prisma.js';
import type { NotificationStatus, ReminderType } from '@prisma/client';

export class NotificationService {
  /**
   * Get notification history (paginated, filterable).
   */
  static async getHistory(params: {
    customerId?: string;
    documentId?: string;
    status?: NotificationStatus;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      customer: { isActive: true },
      document: { isActive: true }
    };
    if (params.customerId) where.customerId = params.customerId;
    if (params.documentId) where.documentId = params.documentId;
    if (params.status) where.notificationStatus = params.status;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get recent notification activity for the home page.
   */
  static async getActivityFeed(limit: number = 20) {
    return prisma.notification.findMany({
      where: {
        customer: { isActive: true },
        document: { isActive: true }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Cancel all pending notifications for a specific document.
   * Called when a document is renewed.
   */
  static async cancelPendingForDocument(documentId: string, reason: string) {
    return prisma.notification.updateMany({
      where: {
        documentId,
        notificationStatus: { in: ['PENDING'] },
      },
      data: {
        notificationStatus: 'CANCELLED',
        deliveryStatus: 'CANCELLED',
        cancellationReason: reason,
      },
    });
  }

  /**
   * Check if a notification has already been sent/created for this exact combination.
   * The unique constraint in DB also prevents duplicates.
   */
  static async isDuplicate(
    customerId: string,
    documentId: string,
    reminderType: ReminderType,
    currentExpiryDate: Date,
    calendarDay: Date
  ): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: {
        customerId,
        documentId,
        reminderType,
        currentExpiryDate,
        calendarDay,
      },
    });
    return !!existing;
  }

  /**
   * Create a notification record.
   */
  static async createNotification(data: {
    customerId: string;
    documentId: string;
    customerName: string;
    phoneNumber: string;
    vehicleNumber: string;
    documentType: string;
    originalExpiryDate: Date;
    currentExpiryDate: Date;
    reminderType: ReminderType;
    message: string;
    calendarDay: Date;
  }) {
    try {
      return await prisma.notification.create({
        data: {
          customerId: data.customerId,
          documentId: data.documentId,
          customerName: data.customerName,
          phoneNumber: data.phoneNumber,
          vehicleNumber: data.vehicleNumber,
          documentType: data.documentType,
          originalExpiryDate: data.originalExpiryDate,
          currentExpiryDate: data.currentExpiryDate,
          reminderType: data.reminderType,
          message: data.message,
          calendarDay: data.calendarDay,
          notificationStatus: 'PENDING',
          deliveryStatus: 'QUEUED',
        },
      });
    } catch (error: unknown) {
      // Handle unique constraint violation (duplicate notification)
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        console.log(`Duplicate notification prevented for customer ${data.customerId}, document ${data.documentId}, type ${data.reminderType}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Mark a notification as sent.
   */
  static async markSent(id: string, providerMessageId?: string) {
    const now = new Date();
    return prisma.notification.update({
      where: { id },
      data: {
        notificationStatus: 'SENT',
        deliveryStatus: 'SENT',
        sentDate: now,
        sentTime: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        providerMessageId,
      },
    });
  }

  /**
   * Mark a notification as delivered.
   */
  static async markDelivered(id: string) {
    return prisma.notification.update({
      where: { id },
      data: {
        notificationStatus: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
      },
    });
  }

  /**
   * Mark a notification as failed.
   */
  static async markFailed(id: string, reason: string) {
    return prisma.notification.update({
      where: { id },
      data: {
        notificationStatus: 'FAILED',
        deliveryStatus: 'FAILED',
        cancellationReason: reason,
      },
    });
  }

  /**
   * Get notifications for a specific customer.
   */
  static async getCustomerNotifications(customerId: string, page: number = 1, limit: number = 20) {
    return this.getHistory({ customerId, page, limit });
  }

  /**
   * Get notifications for a specific document.
   */
  static async getDocumentNotifications(documentId: string, page: number = 1, limit: number = 20) {
    return this.getHistory({ documentId, page, limit });
  }
}
