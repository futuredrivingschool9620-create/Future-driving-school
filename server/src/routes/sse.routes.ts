import { Router } from 'express';
import { streamEvents } from '../controllers/sse.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint for the client to subscribe to SSE
router.get('/', authMiddleware, streamEvents);

export default router;
