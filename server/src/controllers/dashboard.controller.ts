import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { DocumentService } from '../services/document.service.js';
import { SchedulerService } from '../services/scheduler.service.js';
import { getQuery } from '../utils/express.js';

export class DashboardController {
  static async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DashboardService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  static async getExpiringDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(getQuery(req, 'limit') || '50');
      const documents = await DashboardService.getExpiringDocuments(limit);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  static async getPreRenewalDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(getQuery(req, 'limit') || '50');
      const documents = await DocumentService.getPreRenewalDocuments(limit);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  static async getRegistrationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDateQuery = getQuery(req, 'startDate');
      const endDateQuery = getQuery(req, 'endDate');

      const startDate = startDateQuery ? new Date(startDateQuery) : new Date('2025-01-01');
      let endDate = endDateQuery ? new Date(endDateQuery) : new Date();

      // Ensure endDate covers the entire day (up to 23:59:59.999)
      if (endDateQuery) {
        endDate.setHours(23, 59, 59, 999);
      }

      const history = await DashboardService.getRegistrationHistory(startDate, endDate);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  static async triggerExpiryCheck(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await SchedulerService.runExpiryCheck();
      res.json({ message: 'Expiry check completed successfully' });
    } catch (error) {
      next(error);
    }
  }
}
