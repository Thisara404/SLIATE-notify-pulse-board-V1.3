// Authentication API Tests - Integration tests for authentication endpoints
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app'); // Main Express app
const { config } = require('../../src/config/environment');

describe('🌐 Authentication API Tests', () => {
  let testUser;
  let adminToken;
  let superAdminToken;
  let expiredToken;

  beforeAll(async () => {
    // Setup test data
    testUser = {
      username: 'apitest_user',
      email: 'apitest@example.com',
      password: 'TestPass123!',
      fullName: 'API Test User',
      role: 'admin'
    };

    // Generate test tokens
    adminToken = jwt.sign(
      { sub: 1, username: 'admin', role: 'admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    superAdminToken = jwt.sign(
      { sub: 2, username: 'superadmin', role: 'super_admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    expiredToken = jwt.sign(
      { sub: 1, username: 'admin', role: 'admin' },
      config.jwt.secret,
      { expiresIn: '-1h' }
    );
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.tokenType).toBe('Bearer');
      expect(response.body.tokens.expiresIn).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('invalid_credentials');
      expect(response.body.tokens).toBeUndefined();
    });

    test('should reject missing credentials', async () => {
      const testCases = [
        { username: 'admin' }, // Missing password
        { password: 'password' }, // Missing username
        {}, // Missing both
        { username: '', password: 'password' }, // Empty username
        { username: 'admin', password: '' } // Empty password
      ];

      for (const credentials of testCases) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toMatch(/missing_credentials|validation_failed/);
      }
    });

    test('should prevent SQL injection in login', async () => {
      const maliciousInputs = [
        { username: "admin'; DROP TABLE users; --", password: 'password' },
        { username: "' OR '1'='1", password: 'password' },
        { username: 'admin', password: "'; DELETE FROM sessions; --" }
      ];

      for (const credentials of maliciousInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(['invalid_credentials', 'invalid_input']).toContain(response.body.reason);
      }
    });

    test('should prevent XSS in login response', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '<script>alert("XSS")</script>',
          password: 'password'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });

    test('should rate limit login attempts', async () => {
      const credentials = {
        username: 'admin',
        password: 'wrongpassword'
      };

      // Make multiple failed attempts
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send(credentials)
      );

      const responses = await Promise.all(promises);
      
      // Some responses should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout successful');
    });

    test('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/unauthorized|missing_token/);
    });

    test('should reject logout with expired token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/expired|invalid_token/);
    });

    test('should reject logout with malformed token', async () => {
      const malformedTokens = [
        'invalid.token.format',
        'Bearer invalid',
        'Basic notjwt',
        ''
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', token)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('POST /api/auth/register', () => {
    test('should register new user with super admin token', async () => {
      const newUser = {
        username: 'newuser123',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        fullName: 'New User',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe(newUser.username);
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.user.role).toBe(newUser.role);
      expect(response.body.user.passwordHash).toBeUndefined(); // Should not expose password
    });

    test('should reject registration with admin token (insufficient permissions)', async () => {
      const newUser = {
        username: 'unauthorized_user',
        email: 'unauthorized@example.com',
        password: 'SecurePass123!',
        fullName: 'Unauthorized User',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('insufficient_permissions');
    });

    test('should reject registration without authentication', async () => {
      const newUser = {
        username: 'unauthenticated_user',
        email: 'unauth@example.com',
        password: 'SecurePass123!',
        fullName: 'Unauthenticated User',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should validate password strength in registration', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'Password', // Missing number and special char
        'pass!' // Too short
      ];

      for (const password of weakPasswords) {
        const newUser = {
          username: 'testuser',
          email: 'test@example.com',
          password: password,
          fullName: 'Test User',
          role: 'admin'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send(newUser)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toMatch(/weak_password|validation_failed/);
      }
    });

    test('should prevent duplicate usernames', async () => {
      const duplicateUser = {
        username: 'admin', // Existing username
        email: 'newemail@example.com',
        password: 'SecurePass123!',
        fullName: 'Duplicate User',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(duplicateUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('user_exists');
    });

    test('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@.com'
      ];

      for (const email of invalidEmails) {
        const newUser = {
          username: 'testuser123',
          email: email,
          password: 'SecurePass123!',
          fullName: 'Test User',
          role: 'admin'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send(newUser)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toMatch(/validation_failed|invalid_email/);
      }
    });

    test('should sanitize input fields', async () => {
      const maliciousUser = {
        username: '<script>alert("XSS")</script>',
        email: 'test@example.com',
        password: 'SecurePass123!',
        fullName: '<img src=x onerror=alert(1)>',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(maliciousUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('<script>');
      expect(JSON.stringify(response.body)).not.toContain('<img');
    });
  });

  describe('GET /api/auth/profile', () => {
    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBeDefined();
      expect(response.body.user.email).toBeDefined();
      expect(response.body.user.role).toBeDefined();
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    test('should reject profile request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    test('should update profile with valid data', async () => {
      const updateData = {
        fullName: 'Updated Full Name',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.fullName).toBe(updateData.fullName);
      expect(response.body.user.email).toBe(updateData.email);
    });

    test('should validate email format in profile update', async () => {
      const updateData = {
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/validation_failed|invalid_email/);
    });

    test('should prevent XSS in profile update', async () => {
      const maliciousData = {
        fullName: '<script>alert("XSS")</script>',
        email: 'test@example.com'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('should change password with valid data', async () => {
      const passwordData = {
        currentPassword: 'SecurePass123!',
        newPassword: 'NewSecurePass456!',
        confirmPassword: 'NewSecurePass456!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');
    });

    test('should reject weak new passwords', async () => {
      const weakPasswordData = {
        currentPassword: 'SecurePass123!',
        newPassword: 'weak',
        confirmPassword: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/weak_password|validation_failed/);
    });

    test('should reject mismatched password confirmation', async () => {
      const mismatchedData = {
        currentPassword: 'SecurePass123!',
        newPassword: 'NewSecurePass456!',
        confirmPassword: 'DifferentPassword789!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mismatchedData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/password_mismatch|validation_failed/);
    });

    test('should reject incorrect current password', async () => {
      const incorrectCurrentPassword = {
        currentPassword: 'WrongCurrentPass!',
        newPassword: 'NewSecurePass456!',
        confirmPassword: 'NewSecurePass456!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incorrectCurrentPassword)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('invalid_current_password');
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh token with valid refresh token', async () => {
      const refreshToken = jwt.sign(
        { sub: 1, type: 'refresh' },
        config.jwt.refreshSecret || config.jwt.secret,
        { expiresIn: '7d' }
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.tokenType).toBe('Bearer');
    });

    test('should reject expired refresh token', async () => {
      const expiredRefreshToken = jwt.sign(
        { sub: 1, type: 'refresh' },
        config.jwt.refreshSecret || config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredRefreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/invalid_token|expired/);
    });

    test('should reject access token as refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: adminToken }) // Using access token instead of refresh token
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('invalid_token_type');
    });
  });

  describe('GET /api/auth/sessions', () => {
    test('should get user sessions with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toBeDefined();
      expect(Array.isArray(response.body.sessions)).toBe(true);
    });

    test('should reject sessions request without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/auth/sessions/:sessionId', () => {
    test('should revoke specific session', async () => {
      const sessionId = 'test-session-123';

      const response = await request(app)
        .delete(`/api/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Session revoked');
    });

    test('should validate session ID format', async () => {
      const invalidSessionIds = [
        'invalid-session-id',
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        ''
      ];

      for (const sessionId of invalidSessionIds) {
        const response = await request(app)
          .delete(`/api/auth/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('DELETE /api/auth/sessions (revoke all)', () => {
    test('should revoke all other sessions', async () => {
      const response = await request(app)
        .delete('/api/auth/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('sessions revoked');
    });
  });

  describe('API Security Headers', () => {
    test('should include security headers in all responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should not expose sensitive information in headers', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should not expose server information
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should rate limit authentication endpoints', async () => {
      const credentials = {
        username: 'admin',
        password: 'wrongpassword'
      };

      // Make rapid requests to trigger rate limiting
      const promises = Array(15).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send(credentials)
      );

      const responses = await Promise.all(promises);
      
      // Some responses should be rate limited (429 status)
      const rateLimited = responses.filter(res => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Rate limited responses should have proper headers
      rateLimited.forEach(response => {
        expect(response.headers['retry-after']).toBeDefined();
        expect(response.body.error).toContain('rate limit');
      });
    });
  });

  describe('CORS Configuration', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    test('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://evil.com')
        .send({
          username: 'admin',
          password: 'SecurePass123!'
        });

      // Should either reject the request or not include CORS headers
      if (response.status === 200) {
        expect(response.headers['access-control-allow-origin']).not.toBe('http://evil.com');
      }
    });
  });
});