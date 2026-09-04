import { prisma } from '../lib/prisma.js';
import { AuditAction, Prisma } from '@prisma/client';

interface AuditLogInput {
  adminId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string;
}

export class AuditService {
  static async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          adminId: input.adminId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          previousData: (input.previousData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          newData: (input.newData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      console.error('Failed to write audit log:', error);
    }
  }

  static async getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: {
          admin: {
            select: { id: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
