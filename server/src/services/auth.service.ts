import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from '../utils/jwt.js';
import { UnauthorizedError, AppError } from '../utils/errors.js';
import { AuditService } from './audit.service.js';

export class AuthService {
  /**
   * Authenticates an admin and returns access + refresh tokens.
   */
  static async login(
    username: string,
    password: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const admin = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin || !admin.isActive) {
      await AuditService.log({
        entityType: 'AdminUser',
        entityId: username,
        action: 'FAILED_LOGIN',
        ipAddress,
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await comparePassword(password, admin.passwordHash);
    if (!isValid) {
      await AuditService.log({
        adminId: admin.id,
        entityType: 'AdminUser',
        entityId: admin.id,
        action: 'FAILED_LOGIN',
        ipAddress,
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      adminId: admin.id,
      username: admin.username,
    });
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiryDate();

    // Store refresh token hash and update last login
    await Promise.all([
      prisma.refreshToken.create({
        data: {
          tokenHash,
          adminId: admin.id,
          expiresAt,
        },
      }),
      prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      }),
      AuditService.log({
        adminId: admin.id,
        entityType: 'AdminUser',
        entityId: admin.id,
        action: 'LOGIN',
        ipAddress,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Refreshes the access token using a valid refresh token.
   * Implements token rotation — old token is invalidated.
   */
  static async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    const tokenHash = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { admin: true },
    });

    if (!storedToken) {
      // Possible token reuse — revoke ALL tokens for security
      // We can't determine the admin from an unknown token, so just reject
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      // Token expired — clean it up
      await prisma.refreshToken.deleteMany({ where: { id: storedToken.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    if (!storedToken.admin.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Delete old token (rotation)
    await prisma.refreshToken.deleteMany({ where: { id: storedToken.id } });

    // Generate new token pair
    const accessToken = generateAccessToken({
      adminId: storedToken.admin.id,
      username: storedToken.admin.username,
    });

    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = getRefreshTokenExpiryDate();

    await prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        adminId: storedToken.admin.id,
        expiresAt,
      },
    });

    return { accessToken, newRefreshToken };
  }

  /**
   * Invalidates a refresh token (logout).
   */
  static async logout(refreshToken: string, adminId?: string, ipAddress?: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    try {
      await prisma.refreshToken.delete({ where: { tokenHash } });
    } catch {
      // Token may already be deleted — no-op
    }

    if (adminId) {
      await AuditService.log({
        adminId,
        entityType: 'AdminUser',
        entityId: adminId,
        action: 'LOGOUT',
        ipAddress,
      });
    }
  }

  /**
   * Changes admin password after verifying current password.
   */
  static async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string
  ): Promise<void> {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedError('Admin not found');
    }

    const isValid = await comparePassword(currentPassword, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newHash = await hashPassword(newPassword);

    // Update password and revoke all existing refresh tokens
    await Promise.all([
      prisma.adminUser.update({
        where: { id: adminId },
        data: { passwordHash: newHash },
      }),
      // Revoke all sessions — force re-login everywhere
      prisma.refreshToken.deleteMany({
        where: { adminId },
      }),
      AuditService.log({
        adminId,
        entityType: 'AdminUser',
        entityId: adminId,
        action: 'PASSWORD_CHANGE',
        ipAddress,
      }),
    ]);
  }

  /**
   * Get admin profile.
   */
  static async getProfile(adminId: string) {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new AppError('Admin not found', 404);
    }

    return admin;
  }
}
