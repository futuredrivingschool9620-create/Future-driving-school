import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { AuditService } from './audit.service.js';
import { DocumentStatusService } from './documentStatus.service.js';
import { SSEService } from './sse.service.js';
import type { CreateVehicleInput, UpdateVehicleInput, UpdateVehicleStatusInput } from '../validators/vehicle.schema.js';

export class VehicleService {
  /**
   * Add a new vehicle to an existing customer with optional documents.
   */
  static async create(
    customerId: string,
    data: CreateVehicleInput,
    adminId: string,
    ipAddress?: string
  ) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const formattedVehicleNumber = data.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase();

    // Check if this vehicle number is already registered and active
    const existingActiveVehicle = await prisma.vehicle.findFirst({
      where: {
        vehicleNumber: formattedVehicleNumber,
        isActive: true,
      },
      include: {
        customer: { select: { firstName: true, secondName: true, phoneNumber: true } },
      },
    });

    if (existingActiveVehicle) {
      const ownerName = [existingActiveVehicle.customer.firstName, existingActiveVehicle.customer.secondName].filter(Boolean).join(' ');
      throw new BadRequestError(
        `Vehicle ${formattedVehicleNumber} is already registered to customer "${ownerName}" (${existingActiveVehicle.customer.phoneNumber}).`
      );
    }

    const vehicle = await prisma.$transaction(async (tx) => {
      // 1. Create vehicle record
      const newVehicle = await tx.vehicle.create({
        data: {
          customerId,
          vehicleNumber: formattedVehicleNumber,
          vehicleType: data.vehicleType,
          status: data.status || 'Active',
          notes: data.notes || null,
          isActive: true,
          createdByAdminId: adminId,
          updatedByAdminId: adminId,
        },
      });

      // 2. Helper to insert standard documents
      const docsToCreate: Array<{ documentName: string; startDate: string; endDate: string; notes?: string }> = [];

      if (data.insurance?.startDate && data.insurance?.endDate) {
        docsToCreate.push({
          documentName: 'Insurance',
          startDate: data.insurance.startDate,
          endDate: data.insurance.endDate,
        });
      }

      if (data.fc?.startDate && data.fc?.endDate) {
        docsToCreate.push({
          documentName: 'FC',
          startDate: data.fc.startDate,
          endDate: data.fc.endDate,
        });
      }

      if (data.tax?.startDate && data.tax?.endDate) {
        docsToCreate.push({
          documentName: 'Tax',
          startDate: data.tax.startDate,
          endDate: data.tax.endDate,
        });
      }

      if (data.documents && data.documents.length > 0) {
        for (const doc of data.documents) {
          if (doc.documentName?.trim() && doc.startDate && doc.endDate) {
            docsToCreate.push({
              documentName: doc.documentName.trim(),
              startDate: doc.startDate,
              endDate: doc.endDate,
              notes: doc.notes,
            });
          }
        }
      }

      for (const doc of docsToCreate) {
        await tx.document.create({
          data: {
            customerId,
            vehicleId: newVehicle.id,
            documentName: doc.documentName,
            startDate: new Date(doc.startDate),
            endDate: new Date(doc.endDate),
            notes: doc.notes || null,
            isActive: true,
            isCurrent: true,
            createdByAdminId: adminId,
          },
        });
      }

      return tx.vehicle.findUnique({
        where: { id: newVehicle.id },
        include: {
          documents: {
            where: { isActive: true, isCurrent: true },
            orderBy: { endDate: 'asc' },
          },
        },
      });
    });

    if (vehicle) {
      await AuditService.log({
        adminId,
        entityType: 'Vehicle',
        entityId: vehicle.id,
        action: 'CREATE',
        newData: {
          customerId,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.vehicleType,
          status: vehicle.status,
        },
        ipAddress,
      });

      SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId } });
      SSEService.broadcast({ type: 'DOCUMENT_UPDATE', data: { customerId } });
    }

    return vehicle
      ? {
          ...vehicle,
          currentDocuments: DocumentStatusService.buildDocumentSummary(vehicle.documents),
          allDocuments: vehicle.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
        }
      : null;
  }

  /**
   * Get vehicle by ID with full details, documents, renewals, and customer details.
   */
  static async getById(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            secondName: true,
            phoneNumber: true,
            isActive: true,
          },
        },
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
    });

    if (!vehicle) {
      throw new NotFoundError('Vehicle not found');
    }

    const currentDocs = vehicle.documents.filter((d) => d.isCurrent);

    return {
      ...vehicle,
      currentDocuments: DocumentStatusService.buildDocumentSummary(currentDocs),
      allDocuments: vehicle.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
    };
  }

  /**
   * Get all vehicles for a customer.
   */
  static async getByCustomerId(customerId: string) {
    const vehicles = await prisma.vehicle.findMany({
      where: { customerId, isActive: true },
      include: {
        documents: {
          where: { isActive: true, isCurrent: true },
          orderBy: { endDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return vehicles.map((v) => ({
      ...v,
      currentDocuments: DocumentStatusService.buildDocumentSummary(v.documents),
      allDocuments: v.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
    }));
  }

  /**
   * Update vehicle details (number, type, status, notes).
   */
  static async update(
    id: string,
    data: UpdateVehicleInput,
    adminId: string,
    ipAddress?: string
  ) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Vehicle not found');
    }

    if (data.vehicleNumber) {
      const formatted = data.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase();
      if (formatted !== existing.vehicleNumber) {
        const conflict = await prisma.vehicle.findFirst({
          where: {
            vehicleNumber: formatted,
            isActive: true,
            id: { not: id },
          },
        });
        if (conflict) {
          throw new BadRequestError(`Vehicle registration number ${formatted} is already registered.`);
        }
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(data.vehicleNumber && { vehicleNumber: data.vehicleNumber.replace(/[\s\-]/g, '').toUpperCase() }),
        ...(data.vehicleType && { vehicleType: data.vehicleType }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedByAdminId: adminId,
      },
      include: {
        documents: { where: { isActive: true, isCurrent: true } },
      },
    });

    await AuditService.log({
      adminId,
      entityType: 'Vehicle',
      entityId: id,
      action: 'UPDATE',
      previousData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: existing.customerId } });

    return {
      ...updated,
      currentDocuments: DocumentStatusService.buildDocumentSummary(updated.documents),
      allDocuments: updated.documents.map((d) => DocumentStatusService.enrichDocumentWithStatus(d)),
    };
  }

  /**
   * Quick update of vehicle status or active state.
   */
  static async updateStatus(
    id: string,
    data: UpdateVehicleStatusInput,
    adminId: string,
    ipAddress?: string
  ) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Vehicle not found');
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedByAdminId: adminId,
      },
      include: {
        documents: { where: { isActive: true, isCurrent: true } },
      },
    });

    await AuditService.log({
      adminId,
      entityType: 'Vehicle',
      entityId: id,
      action: 'UPDATE',
      previousData: { status: existing.status, isActive: existing.isActive },
      newData: { status: updated.status, isActive: updated.isActive },
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: existing.customerId } });

    return {
      ...updated,
      currentDocuments: DocumentStatusService.buildDocumentSummary(updated.documents),
    };
  }

  /**
   * Soft-delete a single vehicle.
   * Deactivates ONLY this vehicle's documents and cancels ONLY this vehicle's pending notifications.
   * Customer and other vehicles of the customer remain completely untouched!
   */
  static async delete(id: string, adminId: string, ipAddress?: string) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Vehicle not found');
    }

    await prisma.$transaction(async (tx) => {
      // 1. Soft-delete vehicle
      await tx.vehicle.update({
        where: { id },
        data: { isActive: false, updatedByAdminId: adminId },
      });

      // 2. Deactivate only this vehicle's documents
      await tx.document.updateMany({
        where: { vehicleId: id, isActive: true },
        data: { isActive: false, isCurrent: false },
      });

      // 3. Cancel only this vehicle's pending notifications
      await tx.notification.updateMany({
        where: {
          vehicleId: id,
          notificationStatus: 'PENDING',
        },
        data: {
          notificationStatus: 'CANCELLED',
          deliveryStatus: 'CANCELLED',
          cancellationReason: 'Vehicle deleted',
        },
      });
    });

    await AuditService.log({
      adminId,
      entityType: 'Vehicle',
      entityId: id,
      action: 'DELETE',
      previousData: existing as unknown as Record<string, unknown>,
      ipAddress,
    });

    SSEService.broadcast({ type: 'CUSTOMER_UPDATE', data: { customerId: existing.customerId } });
    SSEService.broadcast({ type: 'DOCUMENT_UPDATE', data: { customerId: existing.customerId } });

    return { message: `Vehicle ${existing.vehicleNumber} deleted successfully.` };
  }

  /**
   * Add a document directly to a vehicle.
   */
  static async addDocument(
    vehicleId: string,
    data: { documentName: string; startDate: string; endDate: string; notes?: string },
    adminId: string,
    ipAddress?: string
  ) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundError('Vehicle not found');
    }

    const document = await prisma.$transaction(async (tx) => {
      // Mark any existing current document of same name for this vehicle as isCurrent=false
      await tx.document.updateMany({
        where: {
          vehicleId,
          documentName: data.documentName,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });

      return tx.document.create({
        data: {
          customerId: vehicle.customerId,
          vehicleId,
          documentName: data.documentName,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          notes: data.notes || null,
          isActive: true,
          isCurrent: true,
          createdByAdminId: adminId,
        },
      });
    });

    await AuditService.log({
      adminId,
      entityType: 'Document',
      entityId: document.id,
      action: 'CREATE',
      newData: document as unknown as Record<string, unknown>,
      ipAddress,
    });

    SSEService.broadcast({ type: 'DOCUMENT_UPDATE', data: { documentId: document.id, customerId: vehicle.customerId } });

    return DocumentStatusService.enrichDocumentWithStatus(document);
  }
}
