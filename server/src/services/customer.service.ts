import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { AuditService } from './audit.service.js';
import { DocumentStatusService } from './documentStatus.service.js';
import { VehicleService } from './vehicle.service.js';
import { type CreateCustomerInput, type UpdateCustomerInput, validateAndFormatVehicleNumber } from '../validators/customer.schema.js';
import { SSEService } from './sse.service.js';

function formatFullName(firstName: string, secondName?: string | null): string {
  return [firstName, secondName].filter(Boolean).join(' ').trim() || firstName;
}

export class CustomerService {
  /**
   * Get all customers with their active vehicles and current documents (paginated).
   */
  static async getAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        include: {
          documents: { where: { isCurrent: true, isActive: true } },
          vehicles: {
            where: { isActive: true },
            include: {
              documents: { where: { isCurrent: true, isActive: true }, orderBy: { endDate: 'asc' } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where: { isActive: true } }),
    ]);

    // Enrich with computed document statuses
    const enriched = customers.map((customer) => {
      const enrichedVehicles = customer.vehicles.map((v) => ({
        ...v,
        currentDocuments: DocumentStatusService.buildDocumentSummary(v.documents),
        allDocuments: v.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
      }));

      return {
        ...customer,
        fullName: formatFullName(customer.firstName, customer.secondName),
        currentDocuments: DocumentStatusService.buildDocumentSummary(customer.documents),
        vehicles: enrichedVehicles,
      };
    });

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
   * Get a single customer by ID with full details, vehicles, and documents.
   */
  static async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        documents: {
          where: { isActive: true },
          orderBy: [{ isCurrent: 'desc' }, { documentName: 'asc' }, { createdAt: 'desc' }],
        },
        vehicles: {
          where: { isActive: true },
          include: {
            documents: {
              where: { isActive: true },
              orderBy: [{ isCurrent: 'desc' }, { documentName: 'asc' }, { createdAt: 'desc' }],
            },
            renewalHistories: {
              orderBy: { renewalDate: 'desc' },
              take: 20,
              include: { admin: { select: { id: true, username: true } } },
            },
            notifications: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        createdByAdmin: { select: { id: true, username: true } },
        updatedByAdmin: { select: { id: true, username: true } },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const currentDocs = customer.documents.filter((d) => d.isCurrent);
    const enrichedVehicles = customer.vehicles.map((v) => ({
      ...v,
      currentDocuments: DocumentStatusService.buildDocumentSummary(v.documents.filter((d) => d.isCurrent)),
      allDocuments: v.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
    }));

    return {
      ...customer,
      fullName: formatFullName(customer.firstName, customer.secondName),
      currentDocuments: DocumentStatusService.buildDocumentSummary(currentDocs),
      allDocuments: customer.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
      vehicles: enrichedVehicles,
    };
  }

  /**
   * Create a new customer and attach vehicles.
   * Strictly disallows duplicate mobile numbers.
   */
  static async create(
    data: CreateCustomerInput,
    adminId: string,
    ipAddress?: string
  ) {
    const normalizedPhone = data.phoneNumber.trim();

    // Check if customer already exists by phone number
    const existing = await prisma.customer.findFirst({
      where: { phoneNumber: normalizedPhone, isActive: true },
    });

    if (existing) {
      const existingName = [existing.firstName, existing.secondName].filter(Boolean).join(' ');
      throw new BadRequestError(
        `Mobile number ${normalizedPhone} is already registered to customer "${existingName}". Duplicate mobile numbers are not allowed.`
      );
    }

    const primaryVehicleNumber = data.vehicles?.[0]?.vehicleNumber || (data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : null);
    const primaryVehicleType = data.vehicles?.[0]?.vehicleType || data.vehicleType || null;

    const customer = await prisma.customer.create({
      data: {
        firstName: data.firstName.trim(),
        secondName: data.secondName?.trim() || null,
        vehicleType: primaryVehicleType,
        phoneNumber: normalizedPhone,
        vehicleNumber: primaryVehicleNumber,
        remarks: data.remarks?.trim() || null,
        createdByAdminId: adminId,
        updatedByAdminId: adminId,
      },
    });

    // Now create vehicles for this customer
    if (data.vehicles && data.vehicles.length > 0) {
      for (const vInput of data.vehicles) {
        await VehicleService.create(customer.id, vInput as any, adminId, ipAddress);
      }
    } else if (data.vehicleNumber) {
      await VehicleService.create(
        customer.id,
        {
          vehicleType: (data.vehicleType as any) || '4 Wheeler',
          vehicleNumber: data.vehicleNumber,
          status: 'Active',
          documents: data.documents,
        } as any,
        adminId,
        ipAddress
      );
    }

    await AuditService.log({
      adminId,
      entityType: 'Customer',
      entityId: customer.id,
      action: 'CREATE',
      newData: {
        firstName: customer.firstName,
        secondName: customer.secondName,
        phoneNumber: customer.phoneNumber,
      },
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: customer.id } });

    return CustomerService.getById(customer.id);
  }

  /**
   * Update a customer.
   */
  static async update(id: string, data: UpdateCustomerInput, adminId: string, ipAddress?: string) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    if (data.phoneNumber !== undefined) {
      const normalizedPhone = data.phoneNumber.trim();
      if (normalizedPhone !== existing.phoneNumber) {
        const conflict = await prisma.customer.findFirst({
          where: {
            phoneNumber: normalizedPhone,
            isActive: true,
            id: { not: id },
          },
        });
        if (conflict) {
          const conflictName = [conflict.firstName, conflict.secondName].filter(Boolean).join(' ');
          throw new BadRequestError(
            `Mobile number ${normalizedPhone} is already registered to customer "${conflictName}". Duplicate mobile numbers are not allowed.`
          );
        }
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
        ...(data.secondName !== undefined && { secondName: data.secondName ? data.secondName.trim() : null }),
        ...(data.vehicleType !== undefined && { vehicleType: data.vehicleType || null }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber.trim() }),
        ...(data.vehicleNumber !== undefined && { vehicleNumber: data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : null }),
        ...(data.remarks !== undefined && { remarks: data.remarks ? data.remarks.trim() : null }),
        updatedByAdminId: adminId,
      },
      include: {
        documents: { where: { isCurrent: true, isActive: true } },
        vehicles: {
          where: { isActive: true },
          include: {
            documents: { where: { isCurrent: true, isActive: true } },
          },
        },
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
   * Cascades: deactivates all vehicles, all documents, and cancels all pending notifications.
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

      // 2. Soft-delete all vehicles belonging to this customer
      await tx.vehicle.updateMany({
        where: { customerId: id, isActive: true },
        data: { isActive: false, updatedByAdminId: adminId },
      });

      // 3. Deactivate all documents belonging to this customer
      await tx.document.updateMany({
        where: { customerId: id, isActive: true },
        data: { isActive: false, isCurrent: false },
      });

      // 4. Cancel all pending notifications for this customer
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

    return { message: 'Customer and all associated vehicles and documents deleted successfully' };
  }

  /**
   * Search customers by firstName, secondName, phoneNumber, or vehicleNumber.
   * Rule:
   * - When searching for a customer (by name or phone), show ALL vehicles belonging to that customer.
   * - When searching by vehicle number, show ONLY that specific vehicle for the customer.
   */
  static async search(query: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const searchTerm = query.trim();

    if (!searchTerm) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const cleanedTerm = searchTerm.replace(/[\s\-]/g, '').toUpperCase();
    const formattedTerm = validateAndFormatVehicleNumber(searchTerm);

    // Customer name & phone conditions
    const customerConditions: any[] = [
      { firstName: { contains: searchTerm, mode: 'insensitive' as const } },
      { secondName: { contains: searchTerm, mode: 'insensitive' as const } },
      { phoneNumber: { contains: searchTerm, mode: 'insensitive' as const } },
    ];
    if (cleanedTerm && cleanedTerm !== searchTerm) {
      customerConditions.push({ phoneNumber: { contains: cleanedTerm, mode: 'insensitive' as const } });
    }

    // Vehicle number conditions
    const vehicleConditions: any[] = [
      { vehicleNumber: { contains: searchTerm, mode: 'insensitive' as const } },
    ];
    if (cleanedTerm && cleanedTerm.toLowerCase() !== searchTerm.toLowerCase()) {
      vehicleConditions.push({ vehicleNumber: { contains: cleanedTerm, mode: 'insensitive' as const } });
    }
    if (formattedTerm.valid && formattedTerm.formatted && formattedTerm.formatted.toLowerCase() !== searchTerm.toLowerCase()) {
      vehicleConditions.push({ vehicleNumber: { contains: formattedTerm.formatted, mode: 'insensitive' as const } });
    }

    const where = {
      isActive: true,
      OR: [
        ...customerConditions,
        { vehicleNumber: { contains: searchTerm, mode: 'insensitive' as const } },
        { vehicles: { some: { isActive: true, OR: vehicleConditions } } },
      ],
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          documents: { where: { isCurrent: true, isActive: true } },
          vehicles: {
            where: { isActive: true },
            include: {
              documents: { where: { isCurrent: true, isActive: true }, orderBy: { endDate: 'asc' } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    const lowerTerm = searchTerm.toLowerCase();

    const enriched = customers.map((customer) => {
      // Check if search matched customer personal info (name or phone)
      const matchedNameOrPhone =
        customer.firstName.toLowerCase().includes(lowerTerm) ||
        (customer.secondName && customer.secondName.toLowerCase().includes(lowerTerm)) ||
        customer.phoneNumber.includes(cleanedTerm || searchTerm);

      // If matched name or phone: show ALL vehicles.
      // If matched ONLY by vehicle number: show ONLY that specific vehicle.
      let matchingVehicles = customer.vehicles;

      if (!matchedNameOrPhone) {
        matchingVehicles = customer.vehicles.filter((v) => {
          const vNum = v.vehicleNumber.toUpperCase();
          const vClean = vNum.replace(/[\s\-]/g, '');
          return (
            vNum.includes(searchTerm.toUpperCase()) ||
            (cleanedTerm && vClean.includes(cleanedTerm.toUpperCase())) ||
            (formattedTerm.formatted && vNum.includes(formattedTerm.formatted.toUpperCase()))
          );
        });
      }

      // If no vehicle matched filter (fallback for safety), show all vehicles
      if (matchingVehicles.length === 0 && customer.vehicles.length > 0) {
        matchingVehicles = customer.vehicles;
      }

      const enrichedVehicles = matchingVehicles.map((v) => ({
        ...v,
        currentDocuments: DocumentStatusService.buildDocumentSummary(v.documents),
        allDocuments: v.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
      }));

      return {
        ...customer,
        fullName: formatFullName(customer.firstName, customer.secondName),
        currentDocuments: DocumentStatusService.buildDocumentSummary(customer.documents),
        vehicles: enrichedVehicles,
      };
    });

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
