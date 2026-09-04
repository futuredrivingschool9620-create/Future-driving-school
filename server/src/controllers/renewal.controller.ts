import { Request, Response, NextFunction } from 'express';
import { RenewalService } from '../services/renewal.service.js';
import { getParam, getQuery } from '../utils/express.js';

export class RenewalController {
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await RenewalService.getAll(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getForDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = getParam(req, 'documentId');
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await RenewalService.getHistoryForDocument(documentId, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getForCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = getParam(req, 'customerId');
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await RenewalService.getHistoryForCustomer(customerId, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
