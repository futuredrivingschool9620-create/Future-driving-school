import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { getQuery } from '../utils/express.js';
import type { NotificationStatus } from '@prisma/client';

export class NotificationController {
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const status = getQuery(req, 'status') as NotificationStatus | undefined;
      const customerId = getQuery(req, 'customerId');
      const documentId = getQuery(req, 'documentId');

      const result = await NotificationService.getHistory({
        customerId,
        documentId,
        status,
        page,
        limit,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getActivityFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const notifications = await NotificationService.getActivityFeed(limit);
      res.json(notifications);
    } catch (error) {
      next(error);
    }
  }
}
