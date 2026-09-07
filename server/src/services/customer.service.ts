import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { AuditService } from './audit.service.js';
import { DocumentStatusService } from './documentStatus.service.js';
import { type CreateCustomerInput, type UpdateCustomerInput, validateAndFormatVehicleNumber } from '../validators/customer.schema.js';
import { SSEService } from './sse.service.js';
function formatFullName(firstName: string, secondName?: string | null): string {
  return [firstName, secondName].filter(Boolean).join(' ').trim() || firstName;
}

export class CustomerService {
  /**
   * Get all customers with current documents (paginated).
   */
  static async getAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        include: {
          documents: { where: { isCurrent: true, isActive: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where: { isActive: true } }),
    ]);

    // Enrich with computed document statuses
    const enriched = customers.map((customer) => ({
      ...customer,
      fullName: formatFullName(customer.firstName, customer.secondName),
      currentDocuments: DocumentStatusService.buildDocumentSummary(customer.documents),
    }));

    return {
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single customer by ID with full details.
   */
  static async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        documents: {
          where: { isActive: true },
          orderBy: [{ isCurrent: 'desc' }, { documentName: 'asc' }, { createdAt: 'desc' }],
        },
        createdByAdmin: { select: { id: true, username: true } },
        updatedByAdmin: { select: { id: true, username: true } },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    return {
      ...customer,
      fullName: formatFullName(customer.firstName, customer.secondName),
      currentDocuments: DocumentStatusService.buildDocumentSummary(
        customer.documents.filter((d) => d.isCurrent)
      ),
      allDocuments: customer.documents.map((d) =>
        DocumentStatusService.enrichDocumentWithStatus(d)
      ),
    };
  }

  /**
   * Create a new customer with optional documents.
   */
  static async create(
    data: CreateCustomerInput,
    adminId: string,
    ipAddress?: string
  ) {
    const customer = await prisma.$transaction(async (tx) => {
      // Create the customer
      const newCustomer = await tx.customer.create({
        data: {
          firstName: data.firstName,
          secondName: data.secondName || null,
          vehicleType: data.vehicleType || null,
          phoneNumber: data.phoneNumber,
          vehicleNumber: data.vehicleNumber.toUpperCase(),
          remarks: data.remarks,
          createdByAdminId: adminId,
          updatedByAdminId: adminId,
        },
      });

      // Create documents if provided
      if (data.documents && data.documents.length > 0) {
        for (const doc of data.documents) {
          await tx.document.create({
            data: {
              customerId: newCustomer.id,
              documentName: doc.documentName,
              startDate: new Date(doc.startDate),
              endDate: new Date(doc.endDate),
              isActive: true,
              isCurrent: true,
              createdByAdminId: adminId,
            },
          });
        }
      }

      return tx.customer.findUnique({
        where: { id: newCustomer.id },
        include: {
          documents: { where: { isCurrent: true, isActive: true } },
        },
      });
    });

    if (customer) {
      await AuditService.log({
        adminId,
        entityType: 'Customer',
        entityId: customer.id,
        action: 'CREATE',
        newData: {
          firstName: customer.firstName,
          secondName: customer.secondName,
          vehicleType: customer.vehicleType,
          phoneNumber: customer.phoneNumber,
          vehicleNumber: customer.vehicleNumber,
        },
        ipAddress,
      });
    }

    if (customer) {
      SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: customer.id } });
    }

    return customer
      ? {
          ...customer,
          fullName: formatFullName(customer.firstName, customer.secondName),
          currentDocuments: DocumentStatusService.buildDocumentSummary(customer.documents),
        }
      : null;
  }

  /**
   * Update a customer.
   */
  static async update(id: string, data: UpdateCustomerInput, adminId: string, ipAddress?: string) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.secondName !== undefined && { secondName: data.secondName || null }),
        ...(data.vehicleType !== undefined && { vehicleType: data.vehicleType || null }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.vehicleNumber !== undefined && { vehicleNumber: data.vehicleNumber.toUpperCase() }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        updatedByAdminId: adminId,
      },
      include: {
        documents: { where: { isCurrent: true, isActive: true } },
      },
    });

    await AuditService.log({
      adminId,
      entityType: 'Customer',
      entityId: id,
      action: 'UPDATE',
      previousData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: id } });

    return {
      ...updated,
      fullName: formatFullName(updated.firstName, updated.secondName),
      currentDocuments: DocumentStatusService.buildDocumentSummary(updated.documents),
    };
  }

  /**
   * Soft delete a customer.
   * Cascades: deactivates all documents and cancels all pending notifications.
   */
  static async delete(id: string, adminId: string, ipAddress?: string) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    await prisma.$transaction(async (tx) => {
      // 1. Soft-delete the customer
      await tx.customer.update({
        where: { id },
        data: { isActive: false, updatedByAdminId: adminId },
      });

      // 2. Deactivate all documents belonging to this customer
      await tx.document.updateMany({
        where: { customerId: id, isActive: true },
        data: { isActive: false, isCurrent: false },
      });

      // 3. Cancel all pending notifications for this customer
      await tx.notification.updateMany({
        where: {
          customerId: id,
          notificationStatus: { in: ['PENDING'] },
        },
        data: {
          notificationStatus: 'CANCELLED',
          deliveryStatus: 'CANCELLED',
          cancellationReason: 'Customer deleted',
        },
      });
    });

    await AuditService.log({
      adminId,
      entityType: 'Customer',
      entityId: id,
      action: 'DELETE',
      previousData: existing as unknown as Record<string, unknown>,
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: id } });

    return { message: 'Customer and all associated documents deleted successfully' };
  }

  /**
   * Search customers by firstName, secondName, phone number, or vehicle number.
   */
  static async search(query: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const searchTerm = query.trim();

    if (!searchTerm) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const orConditions: any[] = [
      { firstName: { contains: searchTerm, mode: 'insensitive' as const } },
      { secondName: { contains: searchTerm, mode: 'insensitive' as const } },
      { phoneNumber: { contains: searchTerm, mode: 'insensitive' as const } },
      { vehicleNumber: { contains: searchTerm, mode: 'insensitive' as const } },
    ];

    const cleanedTerm = searchTerm.replace(/[\s\-]/g, '');
    if (cleanedTerm && cleanedTerm.toLowerCase() !== searchTerm.toLowerCase()) {
      orConditions.push({ vehicleNumber: { contains: cleanedTerm, mode: 'insensitive' as const } });
    }

    const formattedTerm = validateAndFormatVehicleNumber(searchTerm);
    if (formattedTerm.valid && formattedTerm.formatted && formattedTerm.formatted.toLowerCase() !== searchTerm.toLowerCase()) {
      orConditions.push({ vehicleNumber: { contains: formattedTerm.formatted, mode: 'insensitive' as const } });
    }

    const where = {
      isActive: true,
      OR: orConditions,
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          documents: { where: { isCurrent: true, isActive: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    const enriched = customers.map((customer) => ({
      ...customer,
      fullName: formatFullName(customer.firstName, customer.secondName),
      currentDocuments: DocumentStatusService.buildDocumentSummary(customer.documents),
    }));

    return {
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
