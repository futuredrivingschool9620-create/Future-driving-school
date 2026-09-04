import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { loginRateLimiter, changePasswordRateLimiter } from '../middleware/rateLimiter.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { loginSchema, changePasswordSchema } from '../validators/auth.schema.js';

const router = Router();

// Public routes
router.post('/login', loginRateLimiter, validate(loginSchema), AuthController.login);
router.post('/refresh', AuthController.refresh);

// Protected routes
router.post('/logout', authMiddleware, AuthController.logout);
router.put(
  '/change-password',
  authMiddleware,
  changePasswordRateLimiter,
  validate(changePasswordSchema),
  AuthController.changePassword
);

export default router;
