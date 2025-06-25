// Security configuration and constants
const { config } = require('./environment');

// Security constants
const SECURITY_CONSTANTS = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: false,
  },
  
  // JWT settings
  JWT: {
    MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    ALGORITHM: 'HS256',
    CLOCK_TOLERANCE: 10, // seconds
  },
  
  // Rate limiting settings
  RATE_LIMITS: {
    GENERAL: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    },
    AUTH: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      skipSuccessfulRequests: true,
    },
    UPLOAD: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10,
    }
  },
  
  // File upload security
  FILE_UPLOAD: {
    MAX_FILES: 5,
    MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB total
    SCAN_FOR_MALWARE: true,
    QUARANTINE_SUSPICIOUS: true,
  },
  
  // XSS protection patterns
  XSS_PATTERNS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ],
  
  // SQL injection patterns
  SQL_INJECTION_PATTERNS: [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UNION( +ALL)?|UPDATE)\b)/gi,
    /((\b(AND|OR)\b.{1,6}?(=|>|<|\bIN\b|\bLIKE\b))|(\bLIKE\b.{1,10}?['\"][%_])|(\b(AND|OR)\b.{1,6}?\b(TRUE|FALSE)\b))/gi,
    /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\s*\(\s*\d+\s*\))/gi,
    /((\bCONCAT\b\s*\()|(\bCHAR\b\s*\(\s*\d)|(\bASCII\b\s*\())/gi,
    /(\b(sp_executesql|xp_cmdshell|sp_makewebtask)\b)/gi,
  ],
  
  // Security headers
  SECURITY_HEADERS: {
    CONTENT_SECURITY_POLICY: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        childSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    HSTS: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    FEATURE_POLICY: {
      camera: ["'none'"],
      microphone: ["'none'"],
      speaker: ["'none'"],
      vibrate: ["'none'"],
      geolocation: ["'none'"],
      accelerometer: ["'none'"],
      ambient_light_sensor: ["'none'"],
      autoplay: ["'none'"],
      gyroscope: ["'none'"],
      magnetometer: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"]
    }
  }
};

// Security validation functions
const securityValidators = {
  // Validate password strength
  validatePassword: (password) => {
    const errors = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }
    
    if (password.length < SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH} characters long`);
    }
    
    if (password.length > SECURITY_CONSTANTS.PASSWORD.MAX_LENGTH) {
      errors.push(`Password must not exceed ${SECURITY_CONSTANTS.PASSWORD.MAX_LENGTH} characters`);
    }
    
    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: calculatePasswordStrength(password)
    };
  },
  
  // Detect potential XSS
  containsXSS: (input) => {
    if (!input || typeof input !== 'string') return false;
    return SECURITY_CONSTANTS.XSS_PATTERNS.some(pattern => pattern.test(input));
  },
  
  // Detect potential SQL injection
  containsSQLInjection: (input) => {
    if (!input || typeof input !== 'string') return false;
    return SECURITY_CONSTANTS.SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
  },
  
  // Validate file type
  isAllowedFileType: (mimetype, isImage = false) => {
    const allowedTypes = isImage ? 
      config.upload.allowedImageTypes : 
      [...config.upload.allowedImageTypes, ...config.upload.allowedFileTypes];
    
    return allowedTypes.includes(mimetype);
  },
  
  // Validate file size
  isValidFileSize: (size, isImage = false) => {
    const maxSize = isImage ? config.upload.maxImageSize : config.upload.maxFileSize;
    return size <= maxSize;
  }
};

// Calculate password strength score
const calculatePasswordStrength = (password) => {
  let score = 0;
  
  // Length bonus
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety bonus
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 2;
  
  // Pattern penalties
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  if (/123|abc|qwe|asd|zxc/i.test(password)) score -= 1; // Common patterns
  
  return Math.max(0, Math.min(10, score));
};

module.exports = {
  SECURITY_CONSTANTS,
  securityValidators,
  calculatePasswordStrength
};