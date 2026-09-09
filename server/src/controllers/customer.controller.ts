import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service.js';
import { prisma } from '../lib/prisma.js';
import { getIp, getParam, getQuery } from '../utils/express.js';

export class CustomerController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await CustomerService.getAll(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = await CustomerService.getById(getParam(req, 'id'));
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }

  static async checkPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const phone = getParam(req, 'phone');
      const excludeId = getQuery(req, 'excludeId');
      const clean = phone.replace(/\D/g, '');
      const existing = await prisma.customer.findFirst({
        where: {
          phoneNumber: clean,
          isActive: true,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        include: {
          vehicles: {
            where: { isActive: true },
            select: { vehicleNumber: true, vehicleType: true },
          },
        },
      });

      if (existing) {
        const name = [existing.firstName, existing.secondName].filter(Boolean).join(' ');
        res.json({
          exists: true,
          message: `Mobile number ${clean} is already registered to "${name}". Duplicate numbers are not allowed.`,
          customer: {
            id: existing.id,
            name,
            phoneNumber: existing.phoneNumber,
            vehicles: existing.vehicles,
          },
        });
      } else {
        res.json({
          exists: false,
          message: 'Mobile number is available.',
        });
      }
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const customer = await CustomerService.create(req.body, adminId, getIp(req));
      res.status(201).json(customer);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const customer = await CustomerService.update(getParam(req, 'id'), req.body, adminId, getIp(req));
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const result = await CustomerService.delete(getParam(req, 'id'), adminId, getIp(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = getQuery(req, 'q') || '';
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await CustomerService.search(query, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
