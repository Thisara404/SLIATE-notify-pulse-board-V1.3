// Security configuration and constants
const { config } = require("./environment");

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
    ALGORITHM: "HS256",
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
    },
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
    /data:text\/html/gi,
  ],

  // SQL injection patterns
  SQL_INJECTION_PATTERNS: [
    // Match only actual SQL injection patterns
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b/i,
    /\b(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
    /['"]\s*(OR|AND)\s*['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i,
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)/i,
    /\bUNION\s+ALL\s+SELECT\b/i,
    /\b(LOAD_FILE|INTO\s+OUTFILE|INFORMATION_SCHEMA)\b/i,
    /(--|#|\/\*)/, // Match SQL comments
    /\b(AND|OR)\s+\d+=\d+/i, // Match boolean-based injection
    /\b(AND|OR)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i,
    /\b(SLEEP|BENCHMARK|WAITFOR)\b/i, // Match time-based injection
    /\b(ASCII|CHAR|HEX|CONCAT|SUBSTRING|CAST|CONVERT)\b/i, // Match function-based injection
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
      preload: true,
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
      usb: ["'none'"],
    },
  },
};

// Security validation functions
const securityValidators = {
  // Validate password strength
  validatePassword: (password) => {
    const errors = [];

    if (!password || typeof password !== "string") {
      errors.push("Password is required");
      return { isValid: false, errors };
    }

    if (password.length < SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH) {
      errors.push(
        `Password must be at least ${SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH} characters long`
      );
    }

    if (password.length > SECURITY_CONSTANTS.PASSWORD.MAX_LENGTH) {
      errors.push(
        `Password must not exceed ${SECURITY_CONSTANTS.PASSWORD.MAX_LENGTH} characters`
      );
    }

    if (
      SECURITY_CONSTANTS.PASSWORD.REQUIRE_UPPERCASE &&
      !/[A-Z]/.test(password)
    ) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (
      SECURITY_CONSTANTS.PASSWORD.REQUIRE_LOWERCASE &&
      !/[a-z]/.test(password)
    ) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (
      SECURITY_CONSTANTS.PASSWORD.REQUIRE_SPECIAL_CHARS &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: calculatePasswordStrength(password),
    };
  },

  // Detect potential XSS
  containsXSS: (input) => {
    if (!input || typeof input !== "string") return false;
    return SECURITY_CONSTANTS.XSS_PATTERNS.some((pattern) =>
      pattern.test(input)
    );
  },

  // Detect potential SQL injection
  containsSQLInjection: (input) => {
    if (!input || typeof input !== "string") return false;

    const isMalicious = SECURITY_CONSTANTS.SQL_INJECTION_PATTERNS.some((pattern) =>
      pattern.test(input)
    );

    if (isMalicious) {
      console.warn('🚨 Potential SQL Injection Detected:', input);
    }

    return isMalicious;
  },

  // Validate file type
  isAllowedFileType: (mimetype, isImage = false) => {
    const allowedImageTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/gif', 
        'image/webp'
    ];
    
    const allowedDocumentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/rtf',
        'application/vnd.oasis.opendocument.text'
    ];
    
    if (isImage) {
        return allowedImageTypes.includes(mimetype);
    }
    
    return [...allowedImageTypes, ...allowedDocumentTypes].includes(mimetype);
},

  // Validate file size
  isValidFileSize: (size, isImage = false) => {
    const maxSize = isImage
      ? config.upload.maxImageSize
      : config.upload.maxFileSize;
    return size <= maxSize;
  },
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
  calculatePasswordStrength,
};
