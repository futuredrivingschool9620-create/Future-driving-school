import { Request, Response } from 'express';

export class DiagnosticsController {
  static logClientDiagnostic(req: Request, res: Response): void {
    const { category, message, endpoint, status, page, memoryMb, details } = req.body;
    const timestamp = new Date().toISOString();

    // Sanitized output — excludes passwords, tokens, customer phone numbers
    console.warn(
      `[CLIENT-DIAGNOSTIC] [${timestamp}] [${String(category || 'UNKNOWN').toUpperCase()}] ` +
      `status=${status ?? 'N/A'} page=${page || 'N/A'} endpoint=${endpoint || 'N/A'} memory=${memoryMb ? `${memoryMb}MB` : 'N/A'} ` +
      `msg="${String(message || 'No message').replace(/[\r\n]+/g, ' ')}" ` +
      (details ? `details="${String(details).slice(0, 300).replace(/[\r\n]+/g, ' ')}"` : '')
    );

    res.status(204).end();
  }
}
