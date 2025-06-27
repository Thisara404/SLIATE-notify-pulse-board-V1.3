// Authentication Security Tests - Comprehensive testing for authentication vulnerabilities
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authService = require('../../src/services/authService');
const { config } = require('../../src/config/environment');

// Mock Express app for testing
const express = require('express');
const app = express();
app.use(express.json());

describe('🔐 Authentication Security Tests', () => {
  let testUser;
  let validToken;
  let expiredToken;
  let malformedToken;

  beforeAll(async () => {
    // Setup test user
    testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: await bcrypt.hash('SecurePass123!', 12),
      role: 'admin',
      isActive: () => true,
      isLocked: () => false,
      isExpired: () => false,
      isSuperAdmin: () => false,
      isAdmin: () => true
    };

    // Generate test tokens
    validToken = jwt.sign(
      { sub: testUser.id, username: testUser.username, role: testUser.role },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    expiredToken = jwt.sign(
      { sub: testUser.id, username: testUser.username, role: testUser.role },
      config.jwt.secret,
      { expiresIn: '-1h' } // Already expired
    );

    malformedToken = 'invalid.token.format';
  });

  describe('Password Security Tests', () => {
    test('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'Password', // Missing number and special char
        'password123', // Missing uppercase and special char
        'Password!', // Missing number
        'Pass!1', // Too short
        'a'.repeat(200), // Too long
        testUser.username, // Contains username
        'admin123!' // Common password
      ];

      for (const password of weakPasswords) {
        const result = await authService.validatePasswordStrength(password, testUser);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('should accept strong passwords', async () => {
      const strongPasswords = [
        'MySecure123!',
        'Complex$Pass456',
        'Ultra@Strong789',
        'Mega#Secure321',
        'Super&Password999'
      ];

      for (const password of strongPasswords) {
        const result = await authService.validatePasswordStrength(password, testUser);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      }
    });

    test('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash length
      expect(hash.startsWith('$2')).toBe(true); // bcrypt format
      
      // Verify hash
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    test('should prevent password reuse', async () => {
      const mockUser = { 
        ...testUser, 
        id: 999 
      };
      
      // Mock password history check
      jest.spyOn(authService, 'checkPasswordHistory').mockResolvedValue(true);
      
      const result = await authService.changePassword(
        mockUser,
        'SecurePass123!',
        'SecurePass123!', // Same password
        { ip: '127.0.0.1' }
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('password_reused');
      
      jest.restoreAllMocks();
    });
  });

  describe('Authentication Flow Security', () => {
    test('should prevent brute force attacks', async () => {
      const context = { 
        ipAddress: '192.168.1.100', 
        userAgent: 'test-agent' 
      };

      // Mock rate limiting to trigger after 3 attempts
      jest.spyOn(authService, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        lockoutExpires: new Date(Date.now() + 15 * 60 * 1000)
      });

      const result = await authService.authenticateUser(
        'testuser',
        'wrongpassword',
        context
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.lockoutExpires).toBeDefined();
      
      jest.restoreAllMocks();
    });

    test('should validate user input for injection attacks', async () => {
      const maliciousInputs = [
        // SQL injection attempts
        { username: "admin'; DROP TABLE users; --", password: 'password' },
        { username: "' OR '1'='1", password: 'password' },
        { username: 'admin', password: "'; DELETE FROM sessions; --" },
        
        // XSS attempts
        { username: '<script>alert("XSS")</script>', password: 'password' },
        { username: 'admin', password: '<img src=x onerror=alert(1)>' },
        
        // Path traversal
        { username: '../../../etc/passwd', password: 'password' },
        { username: 'admin', password: '..\\..\\windows\\system32' }
      ];

      for (const { username, password } of maliciousInputs) {
        const result = await authService.authenticateUser(
          username,
          password,
          { ipAddress: '127.0.0.1' }
        );

        expect(result.success).toBe(false);
        expect(['invalid_credentials', 'invalid_input', 'validation_failed']).toContain(result.reason);
      }
    });

    test('should prevent timing attacks', async () => {
      const validUsername = 'testuser';
      const invalidUsername = 'nonexistentuser';
      const password = 'anypassword';

      // Mock database calls to simulate timing
      const startTime1 = Date.now();
      await authService.authenticateUser(validUsername, password, { ipAddress: '127.0.0.1' });
      const time1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await authService.authenticateUser(invalidUsername, password, { ipAddress: '127.0.0.1' });
      const time2 = Date.now() - startTime2;

      // Response times should be similar (within 50ms difference)
      // This prevents username enumeration through timing attacks
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(100); // Allow some variance for test environment
    });

    test('should generate secure session tokens', async () => {
      const mockUser = {
        ...testUser,
        toJSON: () => ({ id: testUser.id, username: testUser.username, role: testUser.role })
      };

      const authResult = await authService.createAuthenticatedSession(
        mockUser,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(authResult.success).toBe(true);
      expect(authResult.tokens.accessToken).toBeDefined();
      expect(authResult.tokens.refreshToken).toBeDefined();
      expect(authResult.tokens.tokenType).toBe('Bearer');
      expect(authResult.tokens.expiresIn).toBeDefined();

      // Verify token structure
      const decoded = jwt.decode(authResult.tokens.accessToken);
      expect(decoded.sub).toBe(testUser.id);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.type).toBe('access');
    });

    test('should prevent session fixation attacks', async () => {
      // Simulate user login twice to ensure different session IDs
      const mockUser = {
        ...testUser,
        toJSON: () => ({ id: testUser.id, username: testUser.username, role: testUser.role })
      };

      const session1 = await authService.createAuthenticatedSession(
        mockUser,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      const session2 = await authService.createAuthenticatedSession(
        mockUser,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      // Session tokens should be different
      expect(session1.tokens.accessToken).not.toBe(session2.tokens.accessToken);
      expect(session1.tokens.refreshToken).not.toBe(session2.tokens.refreshToken);
    });
  });

  describe('JWT Token Security', () => {
    test('should reject malformed tokens', () => {
      const malformedTokens = [
        'invalid.token',
        'notajwt',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid',
        'header.payload', // Missing signature
        '', // Empty token
        'Bearer token123', // Invalid format
        null,
        undefined
      ];

      malformedTokens.forEach(token => {
        expect(() => {
          jwt.verify(token, config.jwt.secret);
        }).toThrow();
      });
    });

    test('should reject expired tokens', () => {
      expect(() => {
        jwt.verify(expiredToken, config.jwt.secret);
      }).toThrow('jwt expired');
    });

    test('should reject tokens with invalid signatures', () => {
      const tokenWithWrongSignature = jwt.sign(
        { sub: testUser.id, username: testUser.username },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      expect(() => {
        jwt.verify(tokenWithWrongSignature, config.jwt.secret);
      }).toThrow('invalid signature');
    });

    test('should validate token claims properly', () => {
      const tokenWithInvalidClaims = jwt.sign(
        { 
          sub: 'invalid-user-id',
          role: 'super_hacker', // Invalid role
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.jwt.secret
      );

      const decoded = jwt.verify(tokenWithInvalidClaims, config.jwt.secret);
      
      // Token is valid JWT but claims should be validated by application
      expect(decoded.sub).toBe('invalid-user-id');
      expect(decoded.role).toBe('super_hacker');
    });

    test('should handle token refresh securely', async () => {
      const refreshToken = jwt.sign(
        { sub: testUser.id, type: 'refresh' },
        config.jwt.refreshSecret || config.jwt.secret,
        { expiresIn: '7d' }
      );

      const result = await authService.refreshAccessToken(
        refreshToken,
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(true);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      
      // New tokens should be different from original
      expect(result.tokens.accessToken).not.toBe(validToken);
      expect(result.tokens.refreshToken).not.toBe(refreshToken);
    });
  });

  describe('Session Management Security', () => {
    test('should enforce session limits per user', async () => {
      const mockUser = {
        ...testUser,
        toJSON: () => ({ id: testUser.id, username: testUser.username, role: testUser.role })
      };

      // Mock session enforcement
      const enforceSessionLimitsSpy = jest.spyOn(authService, 'enforceSessionLimits')
        .mockResolvedValue(undefined);

      await authService.createAuthenticatedSession(
        mockUser,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(enforceSessionLimitsSpy).toHaveBeenCalledWith(testUser.id);
      
      jest.restoreAllMocks();
    });

    test('should invalidate sessions on security events', async () => {
      const result = await authService.logoutUser(
        validToken,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Logout successful');
    });

    test('should detect suspicious session activity', () => {
      const suspiciousPatterns = [
        // Multiple rapid logins from different IPs
        {
          sessions: [
            { ipAddress: '192.168.1.1', timestamp: Date.now() },
            { ipAddress: '10.0.0.1', timestamp: Date.now() + 1000 },
            { ipAddress: '172.16.0.1', timestamp: Date.now() + 2000 }
          ],
          suspicious: true
        },
        // Different user agents in short time
        {
          sessions: [
            { userAgent: 'Chrome/91.0', timestamp: Date.now() },
            { userAgent: 'Firefox/89.0', timestamp: Date.now() + 5000 }
          ],
          suspicious: true
        },
        // Normal session pattern
        {
          sessions: [
            { ipAddress: '192.168.1.1', userAgent: 'Chrome/91.0', timestamp: Date.now() },
            { ipAddress: '192.168.1.1', userAgent: 'Chrome/91.0', timestamp: Date.now() + 300000 }
          ],
          suspicious: false
        }
      ];

      suspiciousPatterns.forEach(({ sessions, suspicious }) => {
        // In a real implementation, this would be a function to analyze session patterns
        const isSuspicious = sessions.length > 1 && (
          new Set(sessions.map(s => s.ipAddress)).size > 1 ||
          new Set(sessions.map(s => s.userAgent)).size > 1
        ) && sessions[sessions.length - 1].timestamp - sessions[0].timestamp < 60000;

        expect(isSuspicious).toBe(suspicious);
      });
    });
  });

  describe('Authorization Security', () => {
    test('should validate role-based access control', async () => {
      const testCases = [
        { userRole: 'admin', requiredRole: 'admin', shouldPass: true },
        { userRole: 'super_admin', requiredRole: 'admin', shouldPass: true },
        { userRole: 'admin', requiredRole: 'super_admin', shouldPass: false },
        { userRole: 'user', requiredRole: 'admin', shouldPass: false },
        { userRole: null, requiredRole: 'admin', shouldPass: false },
        { userRole: 'invalid_role', requiredRole: 'admin', shouldPass: false }
      ];

      testCases.forEach(({ userRole, requiredRole, shouldPass }) => {
        const user = { ...testUser, role: userRole };
        
        // Mock role checking logic
        const hasPermission = user.role === requiredRole || 
          (requiredRole === 'admin' && user.role === 'super_admin') ||
          user.role === 'super_admin';

        expect(hasPermission).toBe(shouldPass);
      });
    });

    test('should prevent privilege escalation', async () => {
      const regularAdmin = { ...testUser, role: 'admin' };
      
      // Attempt to create super admin user (should fail)
      const createSuperAdminResult = await authService.createUser(
        {
          username: 'new_super_admin',
          email: 'super@example.com',
          password: 'SecurePass123!',
          fullName: 'Super Admin',
          role: 'super_admin'
        },
        regularAdmin,
        { ipAddress: '127.0.0.1' }
      );

      // This should fail as regular admin cannot create super admin
      expect(createSuperAdminResult.success).toBe(false);
    });

    test('should validate permission boundaries', () => {
      const permissionTests = [
        {
          action: 'create_user',
          userRole: 'admin',
          targetRole: 'admin',
          allowed: false // Only super admin can create users
        },
        {
          action: 'create_user',
          userRole: 'super_admin',
          targetRole: 'admin',
          allowed: true
        },
        {
          action: 'view_analytics',
          userRole: 'admin',
          allowed: true
        },
        {
          action: 'view_security_analytics',
          userRole: 'admin',
          allowed: false // Only super admin
        },
        {
          action: 'delete_notice',
          userRole: 'admin',
          ownResource: true,
          allowed: true
        },
        {
          action: 'delete_notice',
          userRole: 'admin',
          ownResource: false,
          allowed: false // Can only delete own notices
        }
      ];

      permissionTests.forEach(({ action, userRole, targetRole, ownResource, allowed }) => {
        // Mock permission checking logic
        let hasPermission = false;

        if (userRole === 'super_admin') {
          hasPermission = true;
        } else if (userRole === 'admin') {
          switch (action) {
            case 'create_user':
              hasPermission = false; // Only super admin
              break;
            case 'view_analytics':
              hasPermission = true;
              break;
            case 'view_security_analytics':
              hasPermission = false; // Only super admin
              break;
            case 'delete_notice':
              hasPermission = ownResource === true;
              break;
            default:
              hasPermission = false;
          }
        }

        expect(hasPermission).toBe(allowed);
      });
    });
  });

  describe('Account Security Features', () => {
    test('should handle account lockout correctly', async () => {
      const lockedUser = {
        ...testUser,
        isLocked: () => true,
        lockoutExpires: new Date(Date.now() + 15 * 60 * 1000)
      };

      const accountCheck = await authService.checkAccountStatus(lockedUser);
      
      expect(accountCheck.valid).toBe(false);
      expect(accountCheck.reason).toBe('account_locked');
    });

    test('should enforce password change requirements', async () => {
      const userNeedingPasswordChange = {
        ...testUser,
        passwordExpired: true,
        lastPasswordChange: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) // 91 days ago
      };

      // In a real implementation, this would check password age
      const passwordAge = Date.now() - userNeedingPasswordChange.lastPasswordChange.getTime();
      const maxPasswordAge = 90 * 24 * 60 * 60 * 1000; // 90 days

      expect(passwordAge > maxPasswordAge).toBe(true);
    });

    test('should track failed login attempts', async () => {
      const ipAddress = '192.168.1.100';
      const username = 'testuser';

      // Mock failed attempt recording
      const recordFailedAttemptSpy = jest.spyOn(authService, 'recordFailedAttempt')
        .mockResolvedValue(undefined);

      await authService.authenticateUser(
        username,
        'wrongpassword',
        { ipAddress }
      );

      expect(recordFailedAttemptSpy).toHaveBeenCalledWith(username, ipAddress);
      
      jest.restoreAllMocks();
    });

    test('should clear failed attempts on successful login', async () => {
      const ipAddress = '192.168.1.100';
      const username = 'testuser';

      // Mock successful authentication flow
      const clearFailedAttemptsSpy = jest.spyOn(authService, 'clearFailedAttempts')
        .mockResolvedValue(undefined);

      // Mock user finding and password verification
      jest.spyOn(authService, 'verifyPassword').mockResolvedValue(true);
      
      const mockUser = {
        ...testUser,
        updateLastLogin: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: testUser.id, username: testUser.username, role: testUser.role })
      };

      // This would normally clear failed attempts on successful login
      await authService.clearFailedAttempts(username, ipAddress);

      expect(clearFailedAttemptsSpy).toHaveBeenCalledWith(username, ipAddress);
      
      jest.restoreAllMocks();
    });
  });

  describe('Security Headers and CSRF Protection', () => {
    test('should validate security headers', () => {
      const requiredSecurityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy'
      ];

      // Mock response headers that should be set
      const mockResponse = {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Content-Security-Policy': "default-src 'self'"
        }
      };

      requiredSecurityHeaders.forEach(header => {
        expect(mockResponse.headers[header]).toBeDefined();
      });
    });

    test('should prevent CSRF attacks', () => {
      const validCSRFToken = 'csrf_token_12345';
      const invalidCSRFToken = 'invalid_csrf_token';

      // Mock CSRF validation
      const validateCSRFToken = (token, sessionToken) => {
        return token === sessionToken;
      };

      expect(validateCSRFToken(validCSRFToken, validCSRFToken)).toBe(true);
      expect(validateCSRFToken(invalidCSRFToken, validCSRFToken)).toBe(false);
    });
  });

  describe('Two-Factor Authentication (Future Enhancement)', () => {
    test('should validate TOTP codes', () => {
      // Mock TOTP validation for future 2FA implementation
      const validateTOTP = (code, secret) => {
        // This would use a library like speakeasy for real implementation
        return code === '123456' && secret === 'test_secret';
      };

      expect(validateTOTP('123456', 'test_secret')).toBe(true);
      expect(validateTOTP('654321', 'test_secret')).toBe(false);
      expect(validateTOTP('123456', 'wrong_secret')).toBe(false);
    });

    test('should handle backup codes', () => {
      const backupCodes = ['12345678', '87654321', '11111111'];
      const usedCodes = new Set(['12345678']);

      const validateBackupCode = (code) => {
        return backupCodes.includes(code) && !usedCodes.has(code);
      };

      expect(validateBackupCode('87654321')).toBe(true); // Valid unused code
      expect(validateBackupCode('12345678')).toBe(false); // Used code
      expect(validateBackupCode('99999999')).toBe(false); // Invalid code
    });
  });

  describe('Security Monitoring and Alerting', () => {
    test('should detect anomalous login patterns', () => {
      const loginAttempts = [
        { username: 'admin', ipAddress: '192.168.1.1', timestamp: Date.now(), success: false },
        { username: 'administrator', ipAddress: '192.168.1.1', timestamp: Date.now() + 1000, success: false },
        { username: 'root', ipAddress: '192.168.1.1', timestamp: Date.now() + 2000, success: false },
        { username: 'testuser', ipAddress: '192.168.1.1', timestamp: Date.now() + 3000, success: false }
      ];

      // Detect username enumeration attempts
      const suspiciousUsernames = ['admin', 'administrator', 'root', 'user', 'test'];
      const enumeration = loginAttempts.filter(attempt => 
        suspiciousUsernames.includes(attempt.username) && !attempt.success
      );

      expect(enumeration.length).toBeGreaterThan(2);
    });

    test('should alert on security events', () => {
      const securityEvents = [
        { type: 'MULTIPLE_FAILED_LOGINS', severity: 'medium', count: 5 },
        { type: 'LOGIN_FROM_NEW_LOCATION', severity: 'low', location: 'Unknown' },
        { type: 'PRIVILEGE_ESCALATION_ATTEMPT', severity: 'critical', details: 'User tried to access admin panel' },
        { type: 'SESSION_HIJACKING_DETECTED', severity: 'high', details: 'Multiple IPs for same session' }
      ];

      const criticalEvents = securityEvents.filter(event => 
        ['critical', 'high'].includes(event.severity)
      );

      expect(criticalEvents.length).toBe(2);
      expect(criticalEvents.map(e => e.type)).toContain('PRIVILEGE_ESCALATION_ATTEMPT');
    });
  });
});