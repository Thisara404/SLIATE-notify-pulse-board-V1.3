// Authentication Service - Business logic for user authentication and authorization
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { config } = require('../config/environment');
const { 
  logAuthentication, 
  logSecurityEvent, 
  logUserAction 
} = require('../utils/logger');
const { sanitize } = require('../utils/inputSanitizer');

class AuthService {
  constructor() {
    // Password requirements
    this.passwordRequirements = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      prohibitCommonPasswords: true,
      prohibitUserInfo: true
    };

    // Session configuration
    this.sessionConfig = {
      maxActiveSessions: 5,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      extendedSessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
      inactivityTimeout: 15 * 60 * 1000 // 15 minutes
    };

    // Rate limiting configuration
    this.rateLimits = {
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      maxPasswordResetAttempts: 3,
      passwordResetWindow: 60 * 60 * 1000 // 1 hour
    };

    // Common weak passwords to reject
    this.commonPasswords = new Set([
      'password', 'password123', '123456', '123456789', 'qwerty',
      'abc123', 'password1', 'admin', 'letmein', 'welcome',
      'monkey', '1234567890', 'dragon', 'princess', 'football',
      'baseball', 'superman', 'michael', 'shadow', 'master'
    ]);
  }

  /**
   * Authenticate user with username and password
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {Object} context - Request context
   * @returns {Object} - Authentication result
   */
  async authenticateUser(username, password, context = {}) {
    try {
      console.log(`🔐 Authenticating user: ${username}`);

      // Step 1: Input validation and sanitization
      const validationResult = await this.validateAuthenticationInput(username, password);
      if (!validationResult.valid) {
        await this.logFailedAuthentication(username, validationResult.reason, context);
        return validationResult;
      }

      const cleanUsername = validationResult.sanitizedUsername;
      const cleanPassword = validationResult.sanitizedPassword;

      // Step 2: Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(cleanUsername, context.ipAddress);
      if (!rateLimitCheck.allowed) {
        await this.logFailedAuthentication(cleanUsername, 'rate_limit_exceeded', context);
        return {
          success: false,
          reason: 'rate_limit_exceeded',
          message: 'Too many failed attempts. Please try again later.',
          lockoutExpires: rateLimitCheck.lockoutExpires
        };
      }

      // Step 3: Find user
      const user = await User.findByUsername(cleanUsername);
      if (!user) {
        await this.recordFailedAttempt(cleanUsername, context.ipAddress);
        await this.logFailedAuthentication(cleanUsername, 'user_not_found', context);
        return {
          success: false,
          reason: 'invalid_credentials',
          message: 'Invalid username or password'
        };
      }

      // Step 4: Check account status
      const accountCheck = await this.checkAccountStatus(user);
      if (!accountCheck.valid) {
        await this.logFailedAuthentication(cleanUsername, accountCheck.reason, context);
        return {
          success: false,
          reason: accountCheck.reason,
          message: accountCheck.message
        };
      }

      // Step 5: Verify password
      const passwordValid = await this.verifyPassword(cleanPassword, user.passwordHash);
      if (!passwordValid) {
        await this.recordFailedAttempt(cleanUsername, context.ipAddress);
        await this.logFailedAuthentication(cleanUsername, 'invalid_password', context);
        return {
          success: false,
          reason: 'invalid_credentials',
          message: 'Invalid username or password'
        };
      }

      // Step 6: Clear failed attempts and create session
      await this.clearFailedAttempts(cleanUsername, context.ipAddress);
      const authResult = await this.createAuthenticatedSession(user, context);

      console.log(`✅ Authentication successful for: ${user.username}`);
      await this.logSuccessfulAuthentication(user, context);

      return authResult;

    } catch (error) {
      console.error('💥 Authentication error:', error.message);
      await this.logFailedAuthentication(username, 'system_error', context);
      
      return {
        success: false,
        reason: 'system_error',
        message: 'An error occurred during authentication'
      };
    }
  }

  /**
   * Validate authentication input
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Object} - Validation result
   */
  async validateAuthenticationInput(username, password) {
    try {
      // Validate required fields
      if (!username || !password) {
        return {
          valid: false,
          reason: 'missing_credentials',
          message: 'Username and password are required'
        };
      }

      // Sanitize inputs
      const usernameResult = sanitize(username, 'username');
      const passwordResult = sanitize(password, 'password');

      if (!usernameResult.safe || !passwordResult.safe) {
        return {
          valid: false,
          reason: 'invalid_input',
          message: 'Invalid characters in credentials'
        };
      }

      // Length validation
      if (usernameResult.sanitized.length < 3 || usernameResult.sanitized.length > 50) {
        return {
          valid: false,
          reason: 'invalid_username_length',
          message: 'Username must be between 3 and 50 characters'
        };
      }

      if (passwordResult.sanitized.length < 1) {
        return {
          valid: false,
          reason: 'empty_password',
          message: 'Password cannot be empty'
        };
      }

      return {
        valid: true,
        sanitizedUsername: usernameResult.sanitized,
        sanitizedPassword: passwordResult.sanitized
      };

    } catch (error) {
      console.error('💥 Input validation error:', error.message);
      return {
        valid: false,
        reason: 'validation_error',
        message: 'Input validation failed'
      };
    }
  }

  /**
   * Check authentication rate limiting
   * @param {string} username - Username
   * @param {string} ipAddress - IP address
   * @returns {Object} - Rate limit check result
   */
  async checkRateLimit(username, ipAddress) {
    try {
      // Implementation would check failed attempts from database/cache
      // For now, return allowed
      return {
        allowed: true,
        attempts: 0,
        lockoutExpires: null
      };

    } catch (error) {
      console.error('💥 Rate limit check error:', error.message);
      return { allowed: true }; // Fail open for availability
    }
  }

  /**
   * Check account status
   * @param {Object} user - User object
   * @returns {Object} - Account status check result
   */
  async checkAccountStatus(user) {
    try {
      if (!user.isActive()) {
        return {
          valid: false,
          reason: 'account_disabled',
          message: 'Account is disabled'
        };
      }

      if (user.isLocked()) {
        return {
          valid: false,
          reason: 'account_locked',
          message: 'Account is temporarily locked'
        };
      }

      if (user.isExpired()) {
        return {
          valid: false,
          reason: 'account_expired',
          message: 'Account has expired'
        };
      }

      return { valid: true };

    } catch (error) {
      console.error('💥 Account status check error:', error.message);
      return {
        valid: false,
        reason: 'status_check_error',
        message: 'Could not verify account status'
      };
    }
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Password hash
   * @returns {boolean} - Whether password is valid
   */
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('💥 Password verification error:', error.message);
      return false;
    }
  }

  /**
   * Create authenticated session
   * @param {Object} user - User object
   * @param {Object} context - Request context
   * @returns {Object} - Authentication result with tokens
   */
  async createAuthenticatedSession(user, context) {
    try {
      // Step 1: Check session limits
      await this.enforceSessionLimits(user.id);

      // Step 2: Generate JWT tokens
      const tokens = await this.generateTokens(user);

      // Step 3: Create session record
      const sessionData = {
        userId: user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: new Date(Date.now() + this.sessionConfig.sessionTimeout),
        refreshExpiresAt: new Date(Date.now() + this.sessionConfig.refreshTokenExpiry)
      };

      const session = await UserSession.create(sessionData);

      // Step 4: Update user's last login
      await user.updateLastLogin(context.ipAddress);

      return {
        success: true,
        user: user.toJSON(),
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: this.sessionConfig.sessionTimeout / 1000,
          tokenType: 'Bearer'
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      };

    } catch (error) {
      console.error('💥 Session creation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   * @param {Object} user - User object
   * @returns {Object} - Generated tokens
   */
  async generateTokens(user) {
    try {
      const now = Math.floor(Date.now() / 1000);

      // Access token payload
      const accessPayload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        type: 'access',
        iat: now,
        exp: now + (this.sessionConfig.sessionTimeout / 1000)
      };

      // Refresh token payload
      const refreshPayload = {
        sub: user.id,
        type: 'refresh',
        iat: now,
        exp: now + (this.sessionConfig.refreshTokenExpiry / 1000)
      };

      const accessToken = jwt.sign(accessPayload, config.jwt.secret, {
        algorithm: config.jwt.algorithm,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      });

      const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret || config.jwt.secret, {
        algorithm: config.jwt.algorithm,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      });

      return { accessToken, refreshToken };

    } catch (error) {
      console.error('💥 Token generation error:', error.message);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @param {Object} context - Request context
   * @returns {Object} - Refresh result
   */
  async refreshAccessToken(refreshToken, context = {}) {
    try {
      console.log('🔄 Refreshing access token');

      // Step 1: Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret || config.jwt.secret);
      
      if (decoded.type !== 'refresh') {
        return {
          success: false,
          reason: 'invalid_token_type',
          message: 'Invalid token type'
        };
      }

      // Step 2: Find session
      const session = await UserSession.findByRefreshToken(refreshToken);
      if (!session || !session.isActive() || session.isExpired()) {
        return {
          success: false,
          reason: 'invalid_session',
          message: 'Invalid or expired session'
        };
      }

      // Step 3: Find user
      const user = await User.findById(decoded.sub);
      if (!user || !user.isActive()) {
        return {
          success: false,
          reason: 'user_not_found',
          message: 'User not found or inactive'
        };
      }

      // Step 4: Generate new access token
      const newTokens = await this.generateTokens(user);

      // Step 5: Update session
      await session.updateTokens(newTokens.accessToken, newTokens.refreshToken);

      console.log(`✅ Token refreshed for user: ${user.username}`);

      return {
        success: true,
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresIn: this.sessionConfig.sessionTimeout / 1000,
          tokenType: 'Bearer'
        }
      };

    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return {
          success: false,
          reason: 'invalid_token',
          message: 'Invalid or expired refresh token'
        };
      }

      console.error('💥 Token refresh error:', error.message);
      return {
        success: false,
        reason: 'refresh_error',
        message: 'Failed to refresh token'
      };
    }
  }

  /**
   * Logout user and invalidate session
   * @param {string} accessToken - Access token
   * @param {Object} context - Request context
   * @returns {Object} - Logout result
   */
  async logoutUser(accessToken, context = {}) {
    try {
      console.log('🔒 Logging out user');

      // Step 1: Decode token to get user info
      const decoded = jwt.decode(accessToken);
      if (!decoded) {
        return {
          success: false,
          reason: 'invalid_token',
          message: 'Invalid access token'
        };
      }

      // Step 2: Find and revoke session
      const session = await UserSession.findByAccessToken(accessToken);
      if (session) {
        await session.revoke();
        console.log(`🔒 Session revoked for user ID: ${decoded.sub}`);
      }

      // Step 3: Log logout event
      await logUserAction(context, 'USER_LOGOUT', {
        userId: decoded.sub,
        username: decoded.username,
        sessionId: session?.id
      });

      return {
        success: true,
        message: 'Logout successful'
      };

    } catch (error) {
      console.error('💥 Logout error:', error.message);
      return {
        success: false,
        reason: 'logout_error',
        message: 'Failed to logout'
      };
    }
  }

  /**
   * Create new user account
   * @param {Object} userData - User data
   * @param {Object} createdBy - User creating the account
   * @param {Object} context - Request context
   * @returns {Object} - Creation result
   */
  async createUser(userData, createdBy, context = {}) {
    try {
      console.log(`👤 Creating user: ${userData.username}`);

      // Step 1: Validate input data
      const validation = await this.validateUserCreationData(userData);
      if (!validation.valid) {
        return validation;
      }

      // Step 2: Check if user exists
      const existingUser = await User.findByUsername(validation.sanitizedData.username);
      if (existingUser) {
        return {
          success: false,
          reason: 'user_exists',
          message: 'User already exists'
        };
      }

      // Step 3: Check email uniqueness
      const existingEmail = await User.findByEmail(validation.sanitizedData.email);
      if (existingEmail) {
        return {
          success: false,
          reason: 'email_exists',
          message: 'Email address already in use'
        };
      }

      // Step 4: Validate password strength
      const passwordValidation = await this.validatePasswordStrength(
        validation.sanitizedData.password,
        validation.sanitizedData
      );
      if (!passwordValidation.valid) {
        return passwordValidation;
      }

      // Step 5: Hash password
      const passwordHash = await this.hashPassword(validation.sanitizedData.password);

      // Step 6: Create user
      const newUserData = {
        ...validation.sanitizedData,
        passwordHash,
        createdBy: createdBy.id
      };

      const user = await User.create(newUserData);

      console.log(`✅ User created successfully: ${user.username}`);

      // Step 7: Log user creation
      await logUserAction(context, 'USER_CREATED', {
        newUserId: user.id,
        newUsername: user.username,
        newUserRole: user.role,
        createdBy: createdBy.username,
        createdById: createdBy.id
      });

      return {
        success: true,
        user: user.toJSON(),
        message: 'User created successfully'
      };

    } catch (error) {
      console.error('💥 User creation error:', error.message);
      return {
        success: false,
        reason: 'creation_error',
        message: 'Failed to create user'
      };
    }
  }

  /**
   * Change user password
   * @param {Object} user - User object
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {Object} context - Request context
   * @returns {Object} - Password change result
   */
  async changePassword(user, currentPassword, newPassword, context = {}) {
    try {
      console.log(`🔒 Changing password for user: ${user.username}`);

      // Step 1: Verify current password
      const currentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
      if (!currentPasswordValid) {
        await logSecurityEvent(context, 'INVALID_CURRENT_PASSWORD', {
          userId: user.id,
          username: user.username,
          severity: 'medium'
        });

        return {
          success: false,
          reason: 'invalid_current_password',
          message: 'Current password is incorrect'
        };
      }

      // Step 2: Validate new password strength
      const passwordValidation = await this.validatePasswordStrength(newPassword, user);
      if (!passwordValidation.valid) {
        return passwordValidation;
      }

      // Step 3: Check password history (prevent reuse)
      const passwordReused = await this.checkPasswordHistory(user.id, newPassword);
      if (passwordReused) {
        return {
          success: false,
          reason: 'password_reused',
          message: 'Cannot reuse recent passwords'
        };
      }

      // Step 4: Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Step 5: Update password
      await user.updatePassword(newPasswordHash);

      // Step 6: Revoke all other sessions for security
      await UserSession.revokeAllUserSessions(user.id, context.sessionId);

      console.log(`✅ Password changed successfully for: ${user.username}`);

      // Step 7: Log password change
      await logSecurityEvent(context, 'PASSWORD_CHANGED', {
        userId: user.id,
        username: user.username,
        severity: 'low'
      });

      return {
        success: true,
        message: 'Password changed successfully. Other sessions have been logged out.'
      };

    } catch (error) {
      console.error('💥 Password change error:', error.message);
      return {
        success: false,
        reason: 'change_error',
        message: 'Failed to change password'
      };
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @param {Object} userInfo - User information for context checking
   * @returns {Object} - Validation result
   */
  async validatePasswordStrength(password, userInfo = {}) {
    try {
      const errors = [];

      // Length check
      if (password.length < this.passwordRequirements.minLength) {
        errors.push(`Password must be at least ${this.passwordRequirements.minLength} characters long`);
      }

      if (password.length > this.passwordRequirements.maxLength) {
        errors.push(`Password must not exceed ${this.passwordRequirements.maxLength} characters`);
      }

      // Character requirements
      if (this.passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      if (this.passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      if (this.passwordRequirements.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      if (this.passwordRequirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      // Common password check
      if (this.passwordRequirements.prohibitCommonPasswords) {
        const lowerPassword = password.toLowerCase();
        if (this.commonPasswords.has(lowerPassword)) {
          errors.push('Password is too common');
        }
      }

      // User info check
      if (this.passwordRequirements.prohibitUserInfo && userInfo.username) {
        if (password.toLowerCase().includes(userInfo.username.toLowerCase())) {
          errors.push('Password cannot contain username');
        }
      }

      if (errors.length > 0) {
        return {
          valid: false,
          reason: 'weak_password',
          message: 'Password does not meet security requirements',
          errors: errors
        };
      }

      return { valid: true };

    } catch (error) {
      console.error('💥 Password validation error:', error.message);
      return {
        valid: false,
        reason: 'validation_error',
        message: 'Failed to validate password'
      };
    }
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {string} - Password hash
   */
  async hashPassword(password) {
    try {
      const saltRounds = 12; // Strong salt rounds
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error('💥 Password hashing error:', error.message);
      throw error;
    }
  }

  /**
   * Validate user creation data
   * @param {Object} userData - User data to validate
   * @returns {Object} - Validation result
   */
  async validateUserCreationData(userData) {
    try {
      const { username, email, password, fullName, role } = userData;

      // Sanitize inputs
      const usernameResult = sanitize(username, 'username');
      const emailResult = sanitize(email, 'email');
      const fullNameResult = sanitize(fullName, 'text');
      const roleResult = sanitize(role, 'text');

      // Check sanitization results
      if (!usernameResult.safe || !emailResult.safe || !fullNameResult.safe) {
        return {
          success: false,
          reason: 'invalid_input',
          message: 'Invalid characters in user data'
        };
      }

      // Validate role
      const validRoles = ['admin', 'super_admin'];
      if (!validRoles.includes(roleResult.sanitized)) {
        return {
          success: false,
          reason: 'invalid_role',
          message: 'Invalid user role'
        };
      }

      return {
        valid: true,
        sanitizedData: {
          username: usernameResult.sanitized,
          email: emailResult.sanitized,
          password: password, // Don't sanitize password
          fullName: fullNameResult.sanitized,
          role: roleResult.sanitized
        }
      };

    } catch (error) {
      console.error('💥 User data validation error:', error.message);
      return {
        valid: false,
        reason: 'validation_error',
        message: 'Failed to validate user data'
      };
    }
  }

  /**
   * Enforce session limits per user
   * @param {number} userId - User ID
   */
  async enforceSessionLimits(userId) {
    try {
      const activeSessions = await UserSession.getActiveSessions(userId);
      
      if (activeSessions.length >= this.sessionConfig.maxActiveSessions) {
        // Revoke oldest sessions
        const sessionsToRevoke = activeSessions
          .sort((a, b) => new Date(a.lastActivity) - new Date(b.lastActivity))
          .slice(0, activeSessions.length - this.sessionConfig.maxActiveSessions + 1);

        for (const session of sessionsToRevoke) {
          await session.revoke();
        }

        console.log(`🔒 Revoked ${sessionsToRevoke.length} old sessions for user ${userId}`);
      }

    } catch (error) {
      console.error('💥 Session limit enforcement error:', error.message);
      // Don't throw - allow login to proceed
    }
  }

  /**
   * Check password history to prevent reuse
   * @param {number} userId - User ID
   * @param {string} newPassword - New password
   * @returns {boolean} - Whether password was reused
   */
  async checkPasswordHistory(userId, newPassword) {
    try {
      // Implementation would check against stored password history
      // For now, return false (no reuse detected)
      return false;

    } catch (error) {
      console.error('💥 Password history check error:', error.message);
      return false; // Fail open
    }
  }

  /**
   * Record failed authentication attempt
   * @param {string} username - Username
   * @param {string} ipAddress - IP address
   */
  async recordFailedAttempt(username, ipAddress) {
    try {
      // Implementation would record in database/cache
      console.log(`🚨 Failed attempt recorded for ${username} from ${ipAddress}`);

    } catch (error) {
      console.error('💥 Failed attempt recording error:', error.message);
    }
  }

  /**
   * Clear failed authentication attempts
   * @param {string} username - Username
   * @param {string} ipAddress - IP address
   */
  async clearFailedAttempts(username, ipAddress) {
    try {
      // Implementation would clear from database/cache
      console.log(`✅ Cleared failed attempts for ${username} from ${ipAddress}`);

    } catch (error) {
      console.error('💥 Failed attempt clearing error:', error.message);
    }
  }

  /**
   * Log successful authentication
   * @param {Object} user - User object
   * @param {Object} context - Request context
   */
  async logSuccessfulAuthentication(user, context) {
    try {
      await logAuthentication(context, { success: true, reason: 'valid_credentials' }, user);
    } catch (error) {
      console.error('💥 Success logging error:', error.message);
    }
  }

  /**
   * Log failed authentication
   * @param {string} username - Username
   * @param {string} reason - Failure reason
   * @param {Object} context - Request context
   */
  async logFailedAuthentication(username, reason, context) {
    try {
      await logAuthentication(context, { success: false, reason }, { username });
    } catch (error) {
      console.error('💥 Failure logging error:', error.message);
    }
  }

  /**
   * Get user security status
   * @param {number} userId - User ID
   * @returns {Object} - Security status
   */
  async getUserSecurityStatus(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { error: 'User not found' };
      }

      const activeSessions = await UserSession.getActiveSessions(userId);
      const recentSessions = await UserSession.getRecentSessions(userId, 10);

      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.isActive(),
          lastLogin: user.lastLoginAt,
          createdAt: user.createdAt
        },
        sessions: {
          active: activeSessions.length,
          maxAllowed: this.sessionConfig.maxActiveSessions,
          recent: recentSessions.map(s => ({
            id: s.id,
            createdAt: s.createdAt,
            lastActivity: s.lastActivity,
            ipAddress: s.ipAddress,
            userAgent: s.userAgent,
            isActive: s.isActive()
          }))
        },
        security: {
          passwordLastChanged: user.passwordChangedAt,
          accountLocked: user.isLocked(),
          failedAttempts: 0 // Would get from database
        }
      };

    } catch (error) {
      console.error('💥 Security status error:', error.message);
      return { error: 'Failed to get security status' };
    }
  }
}

// Create singleton instance
const authService = new AuthService();

module.exports = authService;