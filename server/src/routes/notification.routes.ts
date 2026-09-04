import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', NotificationController.getHistory);
router.get('/activity', NotificationController.getActivityFeed);

export default router;
