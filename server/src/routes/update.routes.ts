import { Router, Request, Response } from 'express';
import { UpdateService } from '../services/update.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /api/app/version
 * Check latest application version and update info.
 * Query param: ?clientVersion=1.2.0
 */
router.get('/version', async (req: Request, res: Response) => {
  try {
    const clientVersion = req.query.clientVersion as string | undefined;
    const info = await UpdateService.getVersionInfo(clientVersion);
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve version information' });
  }
});

/**
 * POST /api/app/version
 * Admin endpoint to update the broadcasted release version, notes, or download link.
 */
router.post('/version', authMiddleware, (req: Request, res: Response) => {
  try {
    const { latestVersion, releaseDate, releaseNotes, downloadUrl, mandatory } = req.body;
    const updated = UpdateService.updateVersionInfo({
      ...(latestVersion && { latestVersion }),
      ...(releaseDate && { releaseDate }),
      ...(releaseNotes && Array.isArray(releaseNotes) && { releaseNotes }),
      ...(downloadUrl && { downloadUrl }),
      ...(typeof mandatory === 'boolean' && { mandatory }),
    });
    res.json({ message: 'App update metadata updated successfully', info: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update version information' });
  }
});

export default router;
