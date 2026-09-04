import { prisma } from '../lib/prisma.js';

export class RenewalService {
  /**
   * Get renewal history for a specific document.
   */
  static async getHistoryForDocument(documentId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.renewalHistory.findMany({
        where: { documentId },
        include: {
          admin: { select: { id: true, username: true } },
          customer: {
            select: { id: true, firstName: true, secondName: true, phoneNumber: true, vehicleNumber: true },
          },
        },
        orderBy: { renewalDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.renewalHistory.count({ where: { documentId } }),
    ]);

    return {
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get renewal history for a specific customer.
   */
  static async getHistoryForCustomer(customerId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.renewalHistory.findMany({
        where: { customerId },
        include: {
          admin: { select: { id: true, username: true } },
          document: { select: { id: true, documentName: true } },
        },
        orderBy: { renewalDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.renewalHistory.count({ where: { customerId } }),
    ]);

    return {
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get all renewal history (paginated).
   */
  static async getAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.renewalHistory.findMany({
        include: {
          admin: { select: { id: true, username: true } },
          customer: {
            select: { id: true, firstName: true, secondName: true, phoneNumber: true, vehicleNumber: true },
          },
          document: { select: { id: true, documentName: true } },
        },
        orderBy: { renewalDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.renewalHistory.count(),
    ]);

    return {
      data: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
