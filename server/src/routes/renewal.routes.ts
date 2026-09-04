import { Router } from 'express';
import { RenewalController } from '../controllers/renewal.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', RenewalController.getAll);
router.get('/document/:documentId', RenewalController.getForDocument);
router.get('/customer/:customerId', RenewalController.getForCustomer);

export default router;
