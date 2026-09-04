import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service.js';
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
