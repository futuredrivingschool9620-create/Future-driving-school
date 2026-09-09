import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller.js';
import { UploadedPdfController } from '../controllers/uploadedPdf.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createDocumentSchema, renewDocumentSchema, updateDocumentSchema } from '../validators/document.schema.js';

const router = Router();

router.use(authMiddleware);

// Uploaded Reference PDFs (must be before /:id)
router.get('/uploaded-pdfs', UploadedPdfController.list);
router.get('/uploaded-pdfs/:id/download', UploadedPdfController.download);

// Customer-scoped document routes
router.get('/customer/:customerId', DocumentController.getCustomerDocuments);
router.post(
  '/customer/:customerId',
  validate(createDocumentSchema),
  DocumentController.create
);

// Document-specific routes
router.get('/:id', DocumentController.getById);
router.put('/:id', validate(updateDocumentSchema), DocumentController.update);
router.delete('/:id', DocumentController.delete);
router.post('/:id/renew', validate(renewDocumentSchema), DocumentController.renew);

// Filter (dashboard)
router.get('/', DocumentController.filterDocuments);

export default router;
