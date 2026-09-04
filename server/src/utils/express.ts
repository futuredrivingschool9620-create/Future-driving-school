import { Request } from 'express';

/**
 * Safely extracts IP address from Express v5 request.
 * Express v5 `req.ip` can return `string | string[]`.
 */
export function getIp(req: Request): string | undefined {
  const ip = req.ip;
  return Array.isArray(ip) ? ip[0] : ip ?? req.socket.remoteAddress;
}

/**
 * Safely extracts a single string param from Express v5 request.
 * Express v5 `req.params[key]` can return `string | string[]`.
 */
export function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Safely extracts a single string query param from Express v5 request.
 */
export function getQuery(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? String(value[0]) : String(value);
}
