import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { getIp } from '../utils/express.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;
      const ipAddress = getIp(req);

      const { accessToken, refreshToken } = await AuthService.login(
        username,
        password,
        ipAddress
      );

      // Set refresh token in HttpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.json({ accessToken });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        res.status(401).json({ error: 'No refresh token provided' });
        return;
      }

      const { accessToken, newRefreshToken } = await AuthService.refreshAccessToken(refreshToken);

      // Set new refresh token cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.json({ accessToken });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const ipAddress = getIp(req);

      if (refreshToken) {
        await AuthService.logout(refreshToken, req.admin?.adminId, ipAddress);
      }

      // Clear cookie
      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const ipAddress = getIp(req);
      const adminId = req.admin!.adminId;

      await AuthService.changePassword(adminId, currentPassword, newPassword, ipAddress);

      // Clear refresh cookie since all sessions are revoked
      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.adminId;
      const profile = await AuthService.getProfile(adminId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }
}
