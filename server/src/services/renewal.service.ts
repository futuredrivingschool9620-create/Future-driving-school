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

  /**
   * Delete renewal history records within a date range (and optionally for a customer).
   */
  static async deleteRange(startDate: string, endDate: string, customerId?: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      renewalDate: {
        gte: start,
        lte: end,
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const result = await prisma.renewalHistory.deleteMany({
      where,
    });

    return result;
  }

  /**
   * Delete multiple renewal history records by IDs.
   */
  static async deleteBatch(ids: string[]) {
    return prisma.renewalHistory.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  /**
   * Delete all renewal history records.
   */
  static async deleteAll() {
    return prisma.renewalHistory.deleteMany({});
  }

  /**
   * Delete a single renewal history record by ID.
   */
  static async delete(id: string) {
    return prisma.renewalHistory.delete({
      where: { id },
    });
  }
}
