import { Router } from 'express';
import { VehicleController } from '../controllers/vehicle.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createVehicleSchema, updateVehicleSchema, updateVehicleStatusSchema } from '../validators/vehicle.schema.js';

const router = Router();

// All vehicle routes require authentication
router.use(authMiddleware);

router.post('/', validate(createVehicleSchema), VehicleController.create);
router.get('/:id', VehicleController.getById);
router.put('/:id', validate(updateVehicleSchema), VehicleController.update);
router.patch('/:id/status', validate(updateVehicleStatusSchema), VehicleController.updateStatus);
router.delete('/:id', VehicleController.delete);
router.post('/:id/documents', VehicleController.addDocument);

export default router;
