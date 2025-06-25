// Input Sanitizer - Comprehensive input cleaning and validation
const { scanForSQLInjection } = require('./sqlInjectionProtection');
const { scanForXSS } = require('./xssProtection');
const { logSecurityEvent } = require('../middleware/logging');

class InputSanitizer {
  constructor() {
    // Input type configurations
    this.inputTypes = {
      // Text input configuration
      text: {
        maxLength: 1000,
        allowedChars: /^[a-zA-Z0-9\s\-_.,!?@#$%^&*()+={}[\]:";'<>/?\\|`~]*$/,
        stripHTML: true,
        encodeEntities: true,
        preventXSS: true,
        preventSQL: true
      },

      // Email input configuration
      email: {
        maxLength: 255,
        allowedChars: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
        stripHTML: true,
        encodeEntities: false,
        preventXSS: true,
        preventSQL: true,
        toLowerCase: true
      },

      // Username input configuration
      username: {
        maxLength: 50,
        minLength: 3,
        allowedChars: /^[a-zA-Z0-9_-]+$/,
        stripHTML: true,
        encodeEntities: false,
        preventXSS: true,
        preventSQL: true,
        toLowerCase: true
      },

      // Password input configuration (minimal sanitization to preserve strength)
      password: {
        maxLength: 128,
        minLength: 8,
        stripHTML: false,
        encodeEntities: false,
        preventXSS: false,
        preventSQL: true
      },

      // Rich text content (notices, descriptions)
      richtext: {
        maxLength: 10000,
        stripHTML: false, // Allow some HTML
        encodeEntities: false,
        preventXSS: true,
        preventSQL: true,
        allowedTags: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        allowedAttributes: ['href', 'title', 'target']
      },

      // Filename input configuration
      filename: {
        maxLength: 255,
        allowedChars: /^[a-zA-Z0-9\-_. ]+$/,
        stripHTML: true,
        encodeEntities: true,
        preventXSS: true,
        preventSQL: true,
        removeSpaces: false
      },

      // URL input configuration
      url: {
        maxLength: 2048,
        stripHTML: true,
        encodeEntities: false,
        preventXSS: true,
        preventSQL: true,
        validateURL: true
      },

      // Numeric input configuration
      numeric: {
        allowedChars: /^[0-9.-]+$/,
        stripHTML: true,
        encodeEntities: false,
        preventXSS: true,
        preventSQL: true
      },

      // Search query configuration
      search: {
        maxLength: 500,
        stripHTML: true,
        encodeEntities: true,
        preventXSS: true,
        preventSQL: true,
        normalizeSpaces: true
      }
    };

    // Common dangerous patterns to remove
    this.dangerousPatterns = [
      // Control characters
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
      
      // Unicode control characters
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
      
      // Null bytes
      /\0/g,
      
      // Directory traversal
      /\.\.\/|\.\.\\|\.\.\%2F|\.\.\%5C/gi,
      
      // Protocol handlers
      /^(javascript|vbscript|data|file|ftp):/i,
      
      // File system paths (Windows/Unix)
      /^([a-zA-Z]:)?[\\\/]/,
      
      // Suspicious Unicode
      /[\uFEFF\u200B-\u200D\u2060\uFFFE\uFFFF]/g
    ];
  }

  /**
   * Sanitize input based on type and context
   * @param {string} input - Input to sanitize
   * @param {string} type - Type of input (text, email, username, etc.)
   * @param {Object} context - Context information
   * @param {Object} customOptions - Custom sanitization options
   * @returns {Object} - Sanitization result
   */
  sanitize(input, type = 'text', context = {}, customOptions = {}) {
    try {
      // Handle non-string inputs
      if (input === null || input === undefined) {
        return { safe: true, sanitized: '', warnings: [] };
      }

      if (typeof input !== 'string') {
        input = String(input);
      }

      const config = { ...this.inputTypes[type], ...customOptions };
      const warnings = [];
      let sanitized = input;
      let originalLength = input.length;

      console.log(`🧹 Sanitizing ${type} input: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`);

      // Step 1: Length validation
      if (config.maxLength && sanitized.length > config.maxLength) {
        sanitized = sanitized.substring(0, config.maxLength);
        warnings.push({
          type: 'LENGTH_TRUNCATED',
          message: `Input truncated from ${originalLength} to ${config.maxLength} characters`,
          severity: 'medium'
        });
      }

      if (config.minLength && sanitized.length < config.minLength) {
        return {
          safe: false,
          sanitized: '',
          warnings: [...warnings, {
            type: 'LENGTH_TOO_SHORT',
            message: `Input must be at least ${config.minLength} characters`,
            severity: 'high'
          }],
          error: `Input too short (minimum ${config.minLength} characters)`
        };
      }

      // Step 2: Remove dangerous patterns
      const beforeDangerous = sanitized;
      for (const pattern of this.dangerousPatterns) {
        sanitized = sanitized.replace(pattern, '');
      }

      if (sanitized !== beforeDangerous) {
        warnings.push({
          type: 'DANGEROUS_PATTERNS_REMOVED',
          message: 'Removed potentially dangerous characters/patterns',
          severity: 'high'
        });
      }

      // Step 3: Character set validation
      if (config.allowedChars && !config.allowedChars.test(sanitized)) {
        if (type === 'email' || type === 'username') {
          // For strict types, reject invalid characters
          return {
            safe: false,
            sanitized: '',
            warnings: [...warnings, {
              type: 'INVALID_CHARACTERS',
              message: `Input contains invalid characters for ${type}`,
              severity: 'high'
            }],
            error: `Invalid characters for ${type} input`
          };
        } else {
          // For other types, remove invalid characters
          const validChars = sanitized.match(config.allowedChars) || [];
          sanitized = validChars.join('');
          warnings.push({
            type: 'INVALID_CHARS_REMOVED',
            message: 'Removed invalid characters',
            severity: 'medium'
          });
        }
      }

      // Step 4: Security scans
      if (config.preventSQL) {
        const sqlScan = scanForSQLInjection(sanitized, context, `${type}_input`);
        if (!sqlScan.safe) {
          warnings.push({
            type: 'SQL_INJECTION_DETECTED',
            message: 'Potential SQL injection detected and neutralized',
            severity: 'critical',
            threats: sqlScan.threats
          });

          // Apply additional SQL sanitization
          sanitized = this.applySQLSanitization(sanitized);
        }
      }

      if (config.preventXSS) {
        const xssScan = scanForXSS(sanitized, context, `${type}_input`, 'html');
        if (!xssScan.safe) {
          warnings.push({
            type: 'XSS_DETECTED',
            message: 'Potential XSS attack detected and neutralized',
            severity: 'critical',
            threats: xssScan.threats
          });

          // Apply XSS sanitization
          sanitized = this.applyXSSSanitization(sanitized, config);
        }
      }

      // Step 5: Type-specific processing
      sanitized = this.applyTypeSpecificSanitization(sanitized, type, config);

      // Step 6: Final validation
      const validationResult = this.validateSanitizedInput(sanitized, type, config);
      if (!validationResult.valid) {
        return {
          safe: false,
          sanitized: '',
          warnings: [...warnings, ...validationResult.warnings],
          error: validationResult.error
        };
      }

      // Calculate safety score
      const safetyScore = this.calculateSafetyScore(warnings);

      console.log(`✅ Input sanitized successfully. Safety score: ${safetyScore}/100`);

      return {
        safe: safetyScore >= 70, // Consider safe if score >= 70
        sanitized,
        warnings,
        safetyScore,
        originalLength,
        sanitizedLength: sanitized.length,
        changesMade: sanitized !== input
      };

    } catch (error) {
      console.error('💥 Input sanitization error:', error.message);

      logSecurityEvent(context, 'SANITIZATION_ERROR', {
        inputType: type,
        error: error.message,
        inputLength: input ? input.length : 0,
        severity: 'medium'
      });

      return {
        safe: false,
        sanitized: '',
        warnings: [],
        error: 'Sanitization failed due to internal error'
      };
    }
  }

  /**
   * Apply SQL-specific sanitization
   * @param {string} input - Input to sanitize
   * @returns {string} - Sanitized input
   */
  applySQLSanitization(input) {
    try {
      let sanitized = input;

      // Remove SQL comments
      sanitized = sanitized.replace(/--.*$/gm, '');
      sanitized = sanitized.replace(/\/\*.*?\*\//gs, '');
      sanitized = sanitized.replace(/#.*$/gm, '');

      // Remove dangerous SQL keywords
      const dangerousSQL = [
        'EXEC', 'EXECUTE', 'DROP', 'DELETE', 'TRUNCATE', 'ALTER',
        'CREATE', 'INSERT', 'UPDATE', 'UNION', 'SELECT'
      ];

      for (const keyword of dangerousSQL) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        sanitized = sanitized.replace(regex, '');
      }

      // Escape quotes
      sanitized = sanitized.replace(/'/g, "''");
      sanitized = sanitized.replace(/"/g, '""');

      // Remove semicolons to prevent stacked queries
      sanitized = sanitized.replace(/;/g, '');

      return sanitized.trim();

    } catch (error) {
      console.error('💥 SQL sanitization error:', error.message);
      return '';
    }
  }

  /**
   * Apply XSS-specific sanitization
   * @param {string} input - Input to sanitize
   * @param {Object} config - Configuration for sanitization
   * @returns {string} - Sanitized input
   */
  applyXSSSanitization(input, config) {
    try {
      let sanitized = input;

      if (config.stripHTML) {
        // Remove all HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } else if (config.allowedTags) {
        // Remove only dangerous tags, keep allowed ones
        const allTags = sanitized.match(/<\/?[^>]+>/g) || [];
        
        for (const tag of allTags) {
          const tagName = tag.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1]?.toLowerCase();
          
          if (tagName && !config.allowedTags.includes(tagName)) {
            sanitized = sanitized.replace(tag, '');
          }
        }
      }

      if (config.encodeEntities) {
        // Encode HTML entities
        const entities = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '/': '&#x2F;',
          '`': '&#x60;',
          '=': '&#x3D;'
        };

        sanitized = sanitized.replace(/[&<>"'`=\/]/g, (char) => entities[char] || char);
      }

      // Remove dangerous protocols
      sanitized = sanitized.replace(/javascript\s*:/gi, '');
      sanitized = sanitized.replace(/vbscript\s*:/gi, '');
      sanitized = sanitized.replace(/data\s*:/gi, '');

      // Remove event handlers
      sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');

      return sanitized;

    } catch (error) {
      console.error('💥 XSS sanitization error:', error.message);
      return '';
    }
  }

  /**
   * Apply type-specific sanitization rules
   * @param {string} input - Input to sanitize
   * @param {string} type - Input type
   * @param {Object} config - Configuration
   * @returns {string} - Sanitized input
   */
  applyTypeSpecificSanitization(input, type, config) {
    try {
      let sanitized = input;

      switch (type) {
        case 'email':
          sanitized = sanitized.toLowerCase().trim();
          // Remove multiple @ symbols (keep only the last one)
          const atCount = (sanitized.match(/@/g) || []).length;
          if (atCount > 1) {
            const parts = sanitized.split('@');
            sanitized = parts[0] + '@' + parts[parts.length - 1];
          }
          break;

        case 'username':
          sanitized = sanitized.toLowerCase().trim();
          // Remove consecutive underscores/hyphens
          sanitized = sanitized.replace(/[-_]{2,}/g, '_');
          // Remove leading/trailing underscores/hyphens
          sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, '');
          break;

        case 'filename':
          sanitized = sanitized.trim();
          // Replace multiple spaces with single space
          sanitized = sanitized.replace(/\s+/g, ' ');
          // Remove leading/trailing dots
          sanitized = sanitized.replace(/^\.+|\.+$/g, '');
          break;

        case 'url':
          sanitized = sanitized.trim();
          // Add protocol if missing
          if (!/^https?:\/\//i.test(sanitized) && sanitized.length > 0) {
            sanitized = 'https://' + sanitized;
          }
          break;

        case 'numeric':
          // Remove all non-numeric characters except decimal point and minus
          sanitized = sanitized.replace(/[^0-9.-]/g, '');
          // Ensure only one decimal point
          const decimalCount = (sanitized.match(/\./g) || []).length;
          if (decimalCount > 1) {
            const parts = sanitized.split('.');
            sanitized = parts[0] + '.' + parts.slice(1).join('');
          }
          break;

        case 'search':
          if (config.normalizeSpaces) {
            sanitized = sanitized.replace(/\s+/g, ' ').trim();
          }
          break;

        case 'richtext':
          // Normalize line breaks
          sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          // Remove excessive line breaks
          sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
          break;
      }

      return sanitized;

    } catch (error) {
      console.error('💥 Type-specific sanitization error:', error.message);
      return input;
    }
  }

  /**
   * Validate sanitized input
   * @param {string} input - Sanitized input
   * @param {string} type - Input type
   * @param {Object} config - Configuration
   * @returns {Object} - Validation result
   */
  validateSanitizedInput(input, type, config) {
    try {
      const warnings = [];

      // Final length check
      if (config.minLength && input.length < config.minLength) {
        return {
          valid: false,
          error: `Input too short after sanitization (minimum ${config.minLength} characters)`,
          warnings
        };
      }

      // Type-specific validation
      switch (type) {
        case 'email':
          const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          if (!emailRegex.test(input)) {
            return {
              valid: false,
              error: 'Invalid email format after sanitization',
              warnings
            };
          }
          break;

        case 'url':
          if (config.validateURL) {
            try {
              new URL(input);
            } catch (e) {
              return {
                valid: false,
                error: 'Invalid URL format after sanitization',
                warnings
              };
            }
          }
          break;

        case 'numeric':
          if (input && isNaN(parseFloat(input))) {
            return {
              valid: false,
              error: 'Invalid numeric value after sanitization',
              warnings
            };
          }
          break;
      }

      return { valid: true, warnings };

    } catch (error) {
      console.error('💥 Input validation error:', error.message);
      return {
        valid: false,
        error: 'Validation failed due to internal error',
        warnings: []
      };
    }
  }

  /**
   * Calculate safety score based on warnings
   * @param {Array} warnings - Array of warnings
   * @returns {number} - Safety score (0-100)
   */
  calculateSafetyScore(warnings) {
    try {
      if (warnings.length === 0) return 100;

      const severityScores = {
        'critical': -40,
        'high': -25,
        'medium': -15,
        'low': -5
      };

      let score = 100;
      for (const warning of warnings) {
        score += severityScores[warning.severity] || -5;
      }

      return Math.max(0, Math.min(100, score));

    } catch (error) {
      console.error('💥 Safety score calculation error:', error.message);
      return 50; // Default to medium safety
    }
  }

  /**
   * Batch sanitize multiple inputs
   * @param {Object} inputs - Object with input values
   * @param {Object} types - Object with input types
   * @param {Object} context - Context information
   * @returns {Object} - Batch sanitization result
   */
  sanitizeBatch(inputs, types, context = {}) {
    try {
      const results = {};
      const overallWarnings = [];
      let overallSafe = true;

      for (const [key, value] of Object.entries(inputs)) {
        const type = types[key] || 'text';
        const result = this.sanitize(value, type, { ...context, field: key });

        results[key] = result;

        if (!result.safe) {
          overallSafe = false;
        }

        if (result.warnings && result.warnings.length > 0) {
          overallWarnings.push(...result.warnings.map(w => ({ ...w, field: key })));
        }
      }

      return {
        safe: overallSafe,
        results,
        warnings: overallWarnings,
        sanitizedData: Object.fromEntries(
          Object.entries(results).map(([key, result]) => [key, result.sanitized])
        )
      };

    } catch (error) {
      console.error('💥 Batch sanitization error:', error.message);
      return {
        safe: false,
        results: {},
        warnings: [],
        error: 'Batch sanitization failed',
        sanitizedData: {}
      };
    }
  }
}

// Create singleton instance
const inputSanitizer = new InputSanitizer();

module.exports = {
  sanitize: (input, type, context, options) => 
    inputSanitizer.sanitize(input, type, context, options),
  
  sanitizeBatch: (inputs, types, context) => 
    inputSanitizer.sanitizeBatch(inputs, types, context),
  
  // Export the class for advanced usage
  InputSanitizer
};