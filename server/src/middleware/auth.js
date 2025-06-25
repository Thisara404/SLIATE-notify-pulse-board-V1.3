// JWT Authentication middleware with enhanced security
const jwt = require('jsonwebtoken');
const { config } = require('../config/environment');
const secureDatabase = require('../config/database');

class AuthMiddleware {
  constructor() {
    this.jwtSecret = config.jwt.secret;
    this.jwtConfig = config.jwt;
    this.invalidTokens = new Set(); // Blacklist for logout
  }

  // Main authentication middleware
  authenticate = async (req, res, next) => {
    try {
      console.log('🔐 Authentication check for:', req.path);
      
      // Extract token from request
      const token = this.extractToken(req);
      
      if (!token) {
        return this.sendUnauthorizedResponse(res, 'No authentication token provided');
      }

      // Check if token is blacklisted
      if (this.invalidTokens.has(token)) {
        return this.sendUnauthorizedResponse(res, 'Token has been invalidated');
      }

      // Verify and decode token
      const decoded = await this.verifyToken(token);
      
      if (!decoded) {
        return this.sendUnauthorizedResponse(res, 'Invalid authentication token');
      }

      // Check if user still exists and is active
      const user = await this.validateUser(decoded);
      
      if (!user) {
        return this.sendUnauthorizedResponse(res, 'User account not found or inactive');
      }

      // Check token expiration
      if (this.isTokenExpired(decoded)) {
        return this.sendUnauthorizedResponse(res, 'Authentication token has expired');
      }

      // Attach user info to request
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        tokenIat: decoded.iat,
        tokenExp: decoded.exp
      };

      req.token = token;

      // Log successful authentication
      console.log(`✅ User authenticated: ${user.username} (${user.role})`);
      
      // Update session tracking
      await this.updateSessionActivity(user.id, req);

      next();
    } catch (error) {
      console.error('💥 Authentication error:', error.message);
      return this.sendUnauthorizedResponse(res, 'Authentication failed');
    }
  };

  // Extract token from request headers
  extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    // Support both "Bearer token" and "token" formats
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    
    return authHeader;
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: [this.jwtConfig.algorithm],
        issuer: this.jwtConfig.issuer,
        audience: this.jwtConfig.audience,
        clockTolerance: 10 // 10 seconds clock tolerance
      });

      // Additional token validation
      if (!decoded.userId || !decoded.role) {
        throw new Error('Invalid token payload');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log('⏰ Token expired:', error.message);
      } else if (error.name === 'JsonWebTokenError') {
        console.log('🚫 Invalid token:', error.message);
      } else {
        console.error('💥 Token verification error:', error.message);
      }
      return null;
    }
  }

  // Validate user exists and is active
  async validateUser(decoded) {
    try {
      const query = `
        SELECT id, username, email, role, full_name, created_at
        FROM users 
        WHERE id = ? AND role = ?
        LIMIT 1
      `;
      
      const result = await secureDatabase.executeQuery(query, [decoded.userId, decoded.role]);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('💥 User validation error:', error.message);
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(decoded) {
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }

  // Update session activity tracking
  async updateSessionActivity(userId, req) {
    try {
      const sessionData = {
        userId,
        ipAddress: this.getClientIP(req),
        userAgent: req.get('User-Agent') || 'Unknown',
        lastActivity: new Date()
      };

      // Hash the token for storage (don't store plaintext)
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(req.token).digest('hex');

      const query = `
        INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at, created_at)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())
        ON DUPLICATE KEY UPDATE
        ip_address = VALUES(ip_address),
        user_agent = VALUES(user_agent)
      `;

      await secureDatabase.executeQuery(query, [
        userId,
        tokenHash,
        sessionData.ipAddress,
        sessionData.userAgent
      ]);
    } catch (error) {
      // Don't fail authentication if session tracking fails
      console.error('⚠️ Session tracking error:', error.message);
    }
  }

  // Get real client IP address
  getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip ||
           'unknown';
  }

  // Role-based authorization middleware
  authorize = (allowedRoles = []) => {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return this.sendForbiddenResponse(res, 'Authentication required');
        }

        // If no specific roles required, just need to be authenticated
        if (allowedRoles.length === 0) {
          return next();
        }

        // Check if user has required role
        if (!allowedRoles.includes(req.user.role)) {
          console.log(`🚫 Access denied for role ${req.user.role}. Required: ${allowedRoles.join(', ')}`);
          return this.sendForbiddenResponse(res, 'Insufficient permissions');
        }

        console.log(`✅ Role authorization passed for ${req.user.role}`);
        next();
      } catch (error) {
        console.error('💥 Authorization error:', error.message);
        return this.sendForbiddenResponse(res, 'Authorization failed');
      }
    };
  };

  // Admin only authorization
  requireAdmin = this.authorize(['admin', 'super_admin']);

  // Super admin only authorization
  requireSuperAdmin = this.authorize(['super_admin']);

  // Optional authentication (doesn't fail if no token)
  optionalAuth = async (req, res, next) => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return next(); // Continue without authentication
      }

      // Try to authenticate, but don't fail if invalid
      const decoded = await this.verifyToken(token);
      
      if (decoded) {
        const user = await this.validateUser(decoded);
        
        if (user && !this.isTokenExpired(decoded)) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.full_name
          };
          
          console.log(`✅ Optional auth successful: ${user.username}`);
        }
      }

      next();
    } catch (error) {
      console.log('⚠️ Optional auth failed, continuing without authentication');
      next();
    }
  };

  // Generate JWT token
  generateToken(user) {
    try {
      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtConfig.expiresIn,
        algorithm: this.jwtConfig.algorithm,
        issuer: this.jwtConfig.issuer,
        audience: this.jwtConfig.audience
      });

      return {
        token,
        expiresIn: this.jwtConfig.expiresIn,
        tokenType: 'Bearer'
      };
    } catch (error) {
      console.error('💥 Token generation error:', error.message);
      throw new Error('Failed to generate authentication token');
    }
  }

  // Invalidate token (logout)
  invalidateToken = (req, res, next) => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        this.invalidTokens.add(token);
        console.log(`🔒 Token invalidated for user: ${req.user?.username}`);
        
        // Clean up old tokens periodically (prevent memory leak)
        if (this.invalidTokens.size > 10000) {
          this.cleanupInvalidTokens();
        }
      }

      next();
    } catch (error) {
      console.error('💥 Token invalidation error:', error.message);
      next(error);
    }
  };

  // Clean up old invalid tokens
  cleanupInvalidTokens() {
    // In production, you'd want to use Redis or database for token blacklist
    // For now, we'll just clear the set when it gets too large
    this.invalidTokens.clear();
    console.log('🧹 Invalid tokens cache cleared');
  }

  // Send unauthorized response
  sendUnauthorizedResponse(res, message = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Send forbidden response
  sendForbiddenResponse(res, message = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Validate token without full authentication (for token refresh)
  validateTokenOnly = async (req, res, next) => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return this.sendUnauthorizedResponse(res, 'No token provided');
      }

      const decoded = await this.verifyToken(token);
      
      if (!decoded) {
        return this.sendUnauthorizedResponse(res, 'Invalid token');
      }

      req.tokenPayload = decoded;
      req.token = token;
      
      next();
    } catch (error) {
      console.error('💥 Token validation error:', error.message);
      return this.sendUnauthorizedResponse(res, 'Token validation failed');
    }
  };
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

module.exports = {
  authenticate: authMiddleware.authenticate,
  authorize: authMiddleware.authorize,
  requireAdmin: authMiddleware.requireAdmin,
  requireSuperAdmin: authMiddleware.requireSuperAdmin,
  optionalAuth: authMiddleware.optionalAuth,
  generateToken: authMiddleware.generateToken.bind(authMiddleware),
  invalidateToken: authMiddleware.invalidateToken,
  validateTokenOnly: authMiddleware.validateTokenOnly
};