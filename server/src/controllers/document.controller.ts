import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service.js';
import { getIp, getParam, getQuery } from '../utils/express.js';

export class DocumentController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = getParam(req, 'customerId');
      const adminId = req.admin!.adminId;
      const document = await DocumentService.create(customerId, req.body, adminId, getIp(req));
      res.status(201).json(document);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const document = await DocumentService.getById(getParam(req, 'id'));
      res.json(document);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const document = await DocumentService.update(getParam(req, 'id'), req.body, adminId, getIp(req));
      res.json(document);
    } catch (error) {
      next(error);
    }
  }

  static async renew(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const document = await DocumentService.renew(getParam(req, 'id'), req.body, adminId, getIp(req));
      res.json(document);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const result = await DocumentService.delete(getParam(req, 'id'), adminId, getIp(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = getParam(req, 'customerId');
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await DocumentService.getCustomerDocuments(customerId, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async filterDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DocumentService.filterDocuments({
        documentName: getQuery(req, 'documentName'),
        status: getQuery(req, 'status'),
        dateFrom: getQuery(req, 'dateFrom'),
        dateTo: getQuery(req, 'dateTo'),
        page: parseInt(getQuery(req, 'page') || '1'),
        limit: parseInt(getQuery(req, 'limit') || '20'),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
