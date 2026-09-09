import { Request, Response, NextFunction } from 'express';
import { CustomerBatchService } from '../services/customerBatch.service.js';
import { getParam, getQuery } from '../utils/express.js';

export class UploadedPdfController {
  /**
   * List all uploaded reference PDFs.
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(getQuery(req, 'page') || '1');
      const limit = parseInt(getQuery(req, 'limit') || '20');
      const result = await CustomerBatchService.getUploadedPdfs(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Stream / download an uploaded reference PDF file.
   */
  static async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req, 'id');
      const file = await CustomerBatchService.getUploadedPdfFile(id);

      res.setHeader('Content-Type', file.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
      res.send(file.buffer);
    } catch (error) {
      next(error);
    }
  }
}
