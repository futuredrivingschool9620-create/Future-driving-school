import { Request, Response, NextFunction } from 'express';
import { CustomerBatchService } from '../services/customerBatch.service.js';
import { getIp } from '../utils/express.js';

export class CustomerBatchController {
  /**
   * Parse uploaded PDF and return preview with validation and duplicate detection.
   */
  static async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileName, fileBase64 } = req.body;
      if (!fileBase64) {
        res.status(400).json({ error: 'Missing PDF file data' });
        return;
      }

      const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');

      const result = await CustomerBatchService.previewFromPdf(buffer, fileName || 'uploaded_customers.pdf');
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm and register valid records, save uploaded PDF to disk and database.
   */
  static async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const { fileName, fileBase64, records } = req.body;

      if (!fileBase64 || !records || !Array.isArray(records)) {
        res.status(400).json({ error: 'Invalid batch confirmation payload' });
        return;
      }

      const result = await CustomerBatchService.confirmAndRegisterBatch(
        { fileName, fileBase64, records },
        adminId,
        getIp(req)
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download sample PDF template.
   */
  static async downloadSample(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buffer = CustomerBatchService.generateSamplePdf();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Customer_Registration_Sample_Template.pdf"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
