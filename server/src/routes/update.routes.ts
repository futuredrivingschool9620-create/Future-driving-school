import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
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

/**
 * GET /api/app/update-bundle.zip
 * Downloads the latest lightweight in-app update bundle.
 */
router.get('/update-bundle.zip', (_req: Request, res: Response) => {
  const rootDir = process.cwd();
  const candidatePaths = [
    path.join(rootDir, 'dist-electron', 'update-bundle.zip'),
    path.join(rootDir, '..', 'dist-electron', 'update-bundle.zip'),
    path.join(rootDir, 'update-bundle.zip'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="update-bundle.zip"');
      return res.sendFile(path.resolve(p));
    }
  }

  res.status(404).json({ error: 'Update bundle not found' });
});

/**
 * GET /api/app/download-installer
 * Downloads the Windows setup installer (.exe).
 */
router.get('/download-installer', (_req: Request, res: Response) => {
  const rootDir = process.cwd();
  const searchDirs = [
    path.join(rootDir, 'dist-electron'),
    path.join(rootDir, '..', 'dist-electron'),
    rootDir,
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        // Look for setup installer exe
        const exeFiles = files
          .filter((f) => f.endsWith('.exe') && !f.includes('unins') && !f.includes('temp'))
          .sort((a, b) => {
            // Prioritize files with "Setup" in the name
            const aSetup = a.includes('Setup') ? 1 : 0;
            const bSetup = b.includes('Setup') ? 1 : 0;
            return bSetup - aSetup;
          });

        if (exeFiles.length > 0) {
          const exePath = path.join(dir, exeFiles[0]);
          res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
          res.setHeader('Content-Disposition', `attachment; filename="${exeFiles[0]}"`);
          return res.sendFile(path.resolve(exePath));
        }
      } catch {
        // Continue to next directory
      }
    }
  }

  // If no installer .exe found, fallback to zip bundle if available
  const zipFallback = path.join(rootDir, 'update-bundle.zip');
  if (fs.existsSync(zipFallback)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="update-bundle.zip"');
    return res.sendFile(path.resolve(zipFallback));
  }

  res.status(404).json({ error: 'Installer executable not found' });
});

export default router;

