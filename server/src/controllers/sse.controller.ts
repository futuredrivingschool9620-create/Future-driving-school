import { Request, Response } from 'express';
import { SSEService } from '../services/sse.service.js';

export const streamEvents = (req: Request, res: Response): void => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform', // no-transform is useful to bypass compression
    Connection: 'keep-alive',
  });

  // req.admin is guaranteed to exist because of authMiddleware
  const adminId = req.admin!.adminId;
  const clientId = SSEService.addClient(adminId, res);

  // Clean up when connection closes
  req.on('close', () => {
    SSEService.removeClient(clientId);
  });
};
