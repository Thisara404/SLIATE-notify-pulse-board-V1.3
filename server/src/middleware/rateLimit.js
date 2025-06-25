// Advanced rate limiting middleware for DDoS and abuse protection
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { config } = require('../config/environment');

class RateLimitMiddleware {
  constructor() {
    this.suspiciousIPs = new Map();
    this.whitelistedIPs = new Set(['127.0.0.1', '::1']); // localhost
    this.blacklistedIPs = new Set();
  }

  // Get client IP with proper forwarded header handling
  getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // Get the first IP from the comma-separated list
      return forwarded.split(',')[0].trim();
    }
    
    return req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.ip ||
           'unknown';
  }

  // Custom key generator for rate limiting
  generateKey = (req) => {
    const ip = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Create composite key for more accurate tracking
    return `${ip}:${userAgent.substring(0, 50)}`;
  };

  // Skip function for whitelisted IPs
  skipWhitelisted = (req) => {
    const ip = this.getClientIP(req);
    return this.whitelistedIPs.has(ip);
  };

  // Skip function for authenticated users (less restrictive)
  skipAuthenticated = (req) => {
    return req.user && req.user.id;
  };

  // Enhanced skip function with blacklist check
  enhancedSkip = (req) => {
    const ip = this.getClientIP(req);
    
    // Never skip blacklisted IPs
    if (this.blacklistedIPs.has(ip)) {
      return false;
    }
    
    // Skip whitelisted IPs
    return this.skipWhitelisted(req);
  };

  // Custom rate limit handler
  rateLimitHandler = (req, res) => {
    const ip = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Log rate limit violation
    console.warn(`🚫 Rate limit exceeded for IP: ${ip}, User-Agent: ${userAgent.substring(0, 100)}`);
    
    // Track suspicious activity
    const suspiciousCount = this.suspiciousIPs.get(ip) || 0;
    this.suspiciousIPs.set(ip, suspiciousCount + 1);
    
    // Auto-blacklist after multiple violations
    if (suspiciousCount >= 10) {
      this.blacklistedIPs.add(ip);
      console.error(`🔒 IP ${ip} automatically blacklisted due to ${suspiciousCount + 1} rate limit violations`);
    }
    
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString()
    });
  };

  // General API rate limiting
  generalLimit = rateLimit({
    windowMs: config.rateLimit.windowMs, // 15 minutes
    max: config.rateLimit.max, // 100 requests per window
    
    // Enhanced options
    standardHeaders: true,
    legacyHeaders: false,
    
    // Custom key generator
    keyGenerator: this.generateKey,
    
    // Enhanced skip function
    skip: this.enhancedSkip,
    
    // Custom handler
    handler: this.rateLimitHandler,
    
    // Store options (in production, use Redis)
    store: new rateLimit.MemoryStore(),
    
    // Additional headers
    onLimitReached: (req, res, options) => {
      const ip = this.getClientIP(req);
      console.warn(`⚠️ Rate limit reached for IP: ${ip}`);
    }
  });

  // Strict authentication rate limiting
  authLimit = rateLimit({
    windowMs: config.rateLimit.windowMs, // 15 minutes
    max: config.rateLimit.authMax, // 5 attempts per window
    
    // More restrictive settings
    standardHeaders: true,
    legacyHeaders: false,
    
    keyGenerator: this.generateKey,
    skip: this.skipWhitelisted, // Only skip whitelisted, not authenticated
    
    // Skip successful requests to allow normal login after failed attempts
    skipSuccessfulRequests: true,
    
    handler: (req, res) => {
      const ip = this.getClientIP(req);
      console.error(`🚨 Authentication rate limit exceeded for IP: ${ip}`);
      
      // More severe tracking for auth failures
      const suspiciousCount = this.suspiciousIPs.get(ip) || 0;
      this.suspiciousIPs.set(ip, suspiciousCount + 3); // Heavier penalty
      
      return res.status(429).json({
        success: false,
        error: 'Too Many Authentication Attempts',
        message: 'Too many login attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes',
        timestamp: new Date().toISOString()
      });
    }
  });

  // File upload rate limiting
  uploadLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 uploads per 5 minutes
    
    keyGenerator: this.generateKey,
    skip: this.enhancedSkip,
    
    handler: (req, res) => {
      const ip = this.getClientIP(req);
      console.warn(`📁 Upload rate limit exceeded for IP: ${ip}`);
      
      return res.status(429).json({
        success: false,
        error: 'Upload Rate Limit Exceeded',
        message: 'Too many file uploads. Please try again in 5 minutes.',
        retryAfter: '5 minutes',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Public API rate limiting (for notice viewing)
  publicLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    
    keyGenerator: this.generateKey,
    skip: this.enhancedSkip,
    
    handler: (req, res) => {
      return res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please slow down.',
        retryAfter: '1 minute',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Slow down middleware for progressive delays
  slowDownMiddleware = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 10, // Allow 10 requests per 15 minutes at full speed
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 10000, // Maximum delay of 10 seconds
    
    keyGenerator: this.generateKey,
    skip: this.enhancedSkip,
    
    onLimitReached: (req, res, options) => {
      const ip = this.getClientIP(req);
      console.warn(`🐌 Slow down limit reached for IP: ${ip}`);
    }
  });

  // Admin operations rate limiting
  adminLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 admin operations per minute
    
    keyGenerator: (req) => {
      // Use user ID for authenticated admin operations
      return req.user ? `admin:${req.user.id}` : this.generateKey(req);
    },
    
    skip: (req) => {
      // Only apply to admin operations
      return !req.user || !['admin', 'super_admin'].includes(req.user.role);
    },
    
    handler: (req, res) => {
      console.warn(`👑 Admin rate limit exceeded for user: ${req.user?.username}`);
      
      return res.status(429).json({
        success: false,
        error: 'Admin Rate Limit Exceeded',
        message: 'Too many administrative operations. Please slow down.',
        retryAfter: '1 minute',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Search rate limiting
  searchLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 searches per minute
    
    keyGenerator: this.generateKey,
    skip: this.enhancedSkip,
    
    handler: (req, res) => {
      return res.status(429).json({
        success: false,
        error: 'Search Rate Limit Exceeded',
        message: 'Too many search requests. Please try again in a minute.',
        retryAfter: '1 minute',
        timestamp: new Date().toISOString()
      });
    }
  });

  // IP blacklist middleware
  blacklistMiddleware = (req, res, next) => {
    const ip = this.getClientIP(req);
    
    if (this.blacklistedIPs.has(ip)) {
      console.error(`🚫 Blocked request from blacklisted IP: ${ip}`);
      
      return res.status(403).json({
        success: false,
        error: 'Access Forbidden',
        message: 'Your IP address has been blocked due to suspicious activity.',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };

  // Add IP to whitelist
  addToWhitelist(ip) {
    this.whitelistedIPs.add(ip);
    console.log(`✅ IP ${ip} added to whitelist`);
  }

  // Remove IP from whitelist
  removeFromWhitelist(ip) {
    this.whitelistedIPs.delete(ip);
    console.log(`❌ IP ${ip} removed from whitelist`);
  }

  // Add IP to blacklist
  addToBlacklist(ip) {
    this.blacklistedIPs.add(ip);
    console.log(`🔒 IP ${ip} added to blacklist`);
  }

  // Remove IP from blacklist
  removeFromBlacklist(ip) {
    this.blacklistedIPs.delete(ip);
    console.log(`🔓 IP ${ip} removed from blacklist`);
  }

  // Get rate limit status
  getRateLimitStatus() {
    return {
      suspiciousIPs: Array.from(this.suspiciousIPs.entries()),
      whitelistedIPs: Array.from(this.whitelistedIPs),
      blacklistedIPs: Array.from(this.blacklistedIPs),
      totalSuspicious: this.suspiciousIPs.size,
      totalWhitelisted: this.whitelistedIPs.size,
      totalBlacklisted: this.blacklistedIPs.size
    };
  }

  // Cleanup old entries periodically
  startCleanup() {
    // Clean up suspicious IPs every hour
    setInterval(() => {
      const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
      let cleaned = 0;
      
      for (const [ip, count] of this.suspiciousIPs.entries()) {
        // Remove IPs with low suspicious activity after 1 hour
        if (count < 5) {
          this.suspiciousIPs.delete(ip);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} suspicious IP entries`);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  // Emergency rate limit bypass (for admins)
  emergencyBypass = (req, res, next) => {
    // Check for emergency bypass header (only in development)
    if (process.env.NODE_ENV === 'development' && req.headers['x-emergency-bypass'] === 'true') {
      console.warn('🚨 Emergency rate limit bypass used');
      return next();
    }
    
    next();
  };
}

// Create singleton instance
const rateLimitMiddleware = new RateLimitMiddleware();

// Start cleanup process
rateLimitMiddleware.startCleanup();

module.exports = {
  general: rateLimitMiddleware.generalLimit,
  auth: rateLimitMiddleware.authLimit,
  upload: rateLimitMiddleware.uploadLimit,
  public: rateLimitMiddleware.publicLimit,
  admin: rateLimitMiddleware.adminLimit,
  search: rateLimitMiddleware.searchLimit,
  slowDown: rateLimitMiddleware.slowDownMiddleware,
  blacklist: rateLimitMiddleware.blacklistMiddleware,
  emergencyBypass: rateLimitMiddleware.emergencyBypass,
  
  // Management functions
  addToWhitelist: rateLimitMiddleware.addToWhitelist.bind(rateLimitMiddleware),
  removeFromWhitelist: rateLimitMiddleware.removeFromWhitelist.bind(rateLimitMiddleware),
  addToBlacklist: rateLimitMiddleware.addToBlacklist.bind(rateLimitMiddleware),
  removeFromBlacklist: rateLimitMiddleware.removeFromBlacklist.bind(rateLimitMiddleware),
  getStatus: rateLimitMiddleware.getRateLimitStatus.bind(rateLimitMiddleware)
};