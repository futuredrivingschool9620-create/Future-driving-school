import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { CustomerController } from '../controllers/customer.controller.js';
import { DocumentController } from '../controllers/document.controller.js';
import { AuditService } from '../services/audit.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getQuery } from '../utils/express.js';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Admin profile
router.get('/me', AuthController.getProfile);

// Search (unified endpoint)
router.get('/search', CustomerController.search);

// Dashboard filter
router.get('/dashboard/filter', DocumentController.filterDocuments);

// Audit logs
router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(getQuery(req, 'page') || '1');
    const limit = parseInt(getQuery(req, 'limit') || '50');
    const result = await AuditService.getAuditLogs(page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
