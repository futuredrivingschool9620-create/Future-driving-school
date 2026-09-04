import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.schema.js';

const router = Router();

// All routes are protected
router.use(authMiddleware);

router.get('/', CustomerController.getAll);
router.get('/:id', CustomerController.getById);
router.post('/', validate(createCustomerSchema), CustomerController.create);
router.put('/:id', validate(updateCustomerSchema), CustomerController.update);
router.delete('/:id', CustomerController.delete);

export default router;
