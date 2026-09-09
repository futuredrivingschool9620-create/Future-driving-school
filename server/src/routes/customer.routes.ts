import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller.js';
import { CustomerBatchController } from '../controllers/customerBatch.controller.js';
import { VehicleController } from '../controllers/vehicle.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.schema.js';
import { createVehicleSchema } from '../validators/vehicle.schema.js';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Batch / PDF upload routes (must be before /:id)
router.post('/upload-pdf/preview', CustomerBatchController.preview);
router.post('/upload-pdf/confirm', CustomerBatchController.confirm);
router.get('/upload-pdf/sample', CustomerBatchController.downloadSample);

// Check duplicate phone number (must be before /:id)
router.get('/check-phone/:phone', CustomerController.checkPhone);

router.get('/', CustomerController.getAll);
router.get('/:id', CustomerController.getById);
router.post('/', validate(createCustomerSchema), CustomerController.create);
router.put('/:id', validate(updateCustomerSchema), CustomerController.update);
router.delete('/:id', CustomerController.delete);

// Customer vehicles
router.get('/:customerId/vehicles', VehicleController.getByCustomerId);
router.post('/:customerId/vehicles', validate(createVehicleSchema), VehicleController.create);

export default router;

