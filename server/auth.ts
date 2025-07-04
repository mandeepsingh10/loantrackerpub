import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { storage } from './storage';
import { UserRole, type LoginCredentials, type CreateUser } from '@shared/schema';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export class AuthService {
  /**
   * Authenticate a user with username and password
   */
  static async authenticateUser(credentials: LoginCredentials): Promise<AuthenticatedUser | null> {
    try {
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user || !user.isActive) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
      
      if (!isValidPassword) {
        return null;
      }

      // Update last login time
      await storage.updateUserLastLogin(user.id);

      return {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        role: user.role as UserRole,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  /**
   * Create a new user with secure password hashing
   */
  static async createUser(userData: CreateUser): Promise<AuthenticatedUser | null> {
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Check if email already exists (if provided)
      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }

      const user = await storage.createUser(userData);

      return {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        role: user.role as UserRole,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      };
    } catch (error) {
      console.error('User creation error:', error);
      throw error;
    }
  }

  /**
   * Generate a secure password reset token
   */
  static generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Request password reset for a user
   */
  static async requestPasswordReset(username: string): Promise<boolean> {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) {
        return false;
      }

      const token = this.generatePasswordResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const success = await storage.setPasswordResetToken(username, token, expiresAt);
      
      if (success) {
        // In a real application, you would send an email here
        console.log(`Password reset token for ${username}: ${token}`);
        console.log(`Token expires at: ${expiresAt.toISOString()}`);
      }

      return success;
    } catch (error) {
      console.error('Password reset request error:', error);
      return false;
    }
  }

  /**
   * Reset password using a valid token
   */
  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, 12);
      return await storage.resetPassword(token, passwordHash);
    } catch (error) {
      console.error('Password reset error:', error);
      return false;
    }
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return false;
      }

      // Verify current password
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidCurrentPassword) {
        return false;
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      
      return await storage.changePassword(userId, newPasswordHash);
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get user by ID for session validation
   */
  static async getUserById(userId: number): Promise<AuthenticatedUser | null> {
    try {
      const user = await storage.getUserById(userId);
      
      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        role: user.role as UserRole,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      };
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }
} 