import { Request, Response, NextFunction } from 'express';
import { RenewalService } from '../services/renewal.service.js';
import { getParam, getQuery } from '../utils/express.js';
import { BadRequestError } from '../utils/errors.js';

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

  static async deleteRange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = (req.body?.startDate || req.query?.startDate) as string;
      const endDate = (req.body?.endDate || req.query?.endDate) as string;
      const customerId = (req.body?.customerId || req.query?.customerId) as string | undefined;

      if (!startDate || !endDate) {
        throw new BadRequestError('Both startDate and endDate are required');
      }

      const result = await RenewalService.deleteRange(startDate, endDate, customerId);
      res.json({
        message: `Successfully deleted ${result.count} renewal records`,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('ids array is required');
      }
      const result = await RenewalService.deleteBatch(ids);
      res.json({
        message: `Successfully deleted ${result.count} renewal records`,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RenewalService.deleteAll();
      res.json({
        message: `Successfully deleted all ${result.count} renewal records`,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req, 'id');
      await RenewalService.delete(id);
      res.json({ message: 'Renewal record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
