import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/stats', DashboardController.getStats);
router.get('/expiring', DashboardController.getExpiringDocuments);
router.get('/pre-renewal', DashboardController.getPreRenewalDocuments);
router.get('/registrations', DashboardController.getRegistrationHistory);
router.post('/trigger-check', DashboardController.triggerExpiryCheck);

export default router;
