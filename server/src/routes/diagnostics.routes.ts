import { Router } from 'express';
import { DiagnosticsController } from '../controllers/diagnostics.controller.js';

const router = Router();

router.post('/', DiagnosticsController.logClientDiagnostic);

export default router;
