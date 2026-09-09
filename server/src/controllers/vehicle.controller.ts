import { Request, Response, NextFunction } from 'express';
import { VehicleService } from '../services/vehicle.service.js';
import { getIp, getParam } from '../utils/express.js';

export class VehicleController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = getParam(req, 'customerId') || req.body.customerId;
      const adminId = req.admin!.adminId;
      const vehicle = await VehicleService.create(customerId, req.body, adminId, getIp(req));
      res.status(201).json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicle = await VehicleService.getById(getParam(req, 'id'));
      res.json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async getByCustomerId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicles = await VehicleService.getByCustomerId(getParam(req, 'customerId'));
      res.json(vehicles);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const vehicle = await VehicleService.update(getParam(req, 'id'), req.body, adminId, getIp(req));
      res.json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const vehicle = await VehicleService.updateStatus(getParam(req, 'id'), req.body, adminId, getIp(req));
      res.json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const result = await VehicleService.delete(getParam(req, 'id'), adminId, getIp(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async addDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const doc = await VehicleService.addDocument(getParam(req, 'id'), req.body, adminId, getIp(req));
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  }
}
