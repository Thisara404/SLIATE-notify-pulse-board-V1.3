// Slug Generator - SEO-friendly URL slug generation with security
const crypto = require('crypto');
const { logSecurityEvent } = require('../middleware/logging');

class SlugGenerator {
  constructor() {
    // Character mappings for different languages and special characters
    this.characterMappings = {
      // Latin extended characters
      'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
      'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
      'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I', 'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
      'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O', 'Œ': 'OE',
      'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'œ': 'oe',
      'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
      'Ý': 'Y', 'Ÿ': 'Y', 'ý': 'y', 'ÿ': 'y',
      'Ñ': 'N', 'ñ': 'n', 'Ç': 'C', 'ç': 'c',
      'Ð': 'D', 'ð': 'd', 'Þ': 'TH', 'þ': 'th', 'ß': 'ss',

      // Greek characters
      'Α': 'A', 'Β': 'B', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Θ': 'TH',
      'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M', 'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P',
      'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y', 'Φ': 'F', 'Χ': 'CH', 'Ψ': 'PS', 'Ω': 'W',
      'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'h', 'θ': 'th',
      'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
      'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'w',

      // Cyrillic characters
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'ZH',
      'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
      'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'KH', 'Ц': 'TS',
      'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA',
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',

      // Arabic numerals in other scripts
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',

      // Common symbols and punctuation
      '&': 'and', '@': 'at', '©': 'copyright', '®': 'registered', '™': 'trademark',
      '€': 'euro', '£': 'pound', '$': 'dollar', '¥': 'yen', '₹': 'rupee',
      '%': 'percent', '#': 'hash', '*': 'star', '+': 'plus', '=': 'equals',
      '<': 'less', '>': 'greater', '|': 'pipe', '\\': 'backslash', '/': 'slash',
      '~': 'tilde', '`': 'backtick', '^': 'caret', '[': 'bracket', ']': 'bracket',
      '{': 'brace', '}': 'brace', '(': 'paren', ')': 'paren', '"': 'quote', "'": 'quote'
    };

    // Words to exclude from slugs (SEO stopwords)
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
      'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
      'or', 'but', 'not', 'nor', 'so', 'yet', 'can', 'could', 'may', 'might', 'must',
      'shall', 'should', 'would', 'have', 'had', 'been', 'being', 'do', 'does', 'did',
      'am', 'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours',
      'this', 'these', 'that', 'those', 'there', 'here', 'where', 'when', 'what',
      'who', 'whom', 'whose', 'which', 'why', 'how', 'all', 'any', 'both', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
      'than', 'too', 'very', 'just', 'now', 'then', 'once', 'again', 'also', 'still'
    ]);

    // Reserved URL patterns to avoid
    this.reservedPatterns = new Set([
      'admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 'user', 'test',
      'staging', 'dev', 'development', 'prod', 'production', 'demo', 'beta',
      'app', 'mobile', 'web', 'site', 'blog', 'shop', 'store', 'forum', 'chat',
      'support', 'help', 'contact', 'about', 'home', 'index', 'main', 'default',
      'login', 'logout', 'signin', 'signup', 'register', 'auth', 'oauth',
      'dashboard', 'panel', 'control', 'settings', 'config', 'profile', 'account',
      'upload', 'download', 'file', 'files', 'image', 'images', 'photo', 'photos',
      'video', 'videos', 'audio', 'media', 'static', 'assets', 'public', 'private',
      'error', '404', '500', 'forbidden', 'unauthorized', 'maintenance',
      'search', 'results', 'page', 'post', 'article', 'news', 'feed', 'rss', 'xml',
      'json', 'csv', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'tar',
      'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace', 'connect'
    ]);

    // Security patterns to detect and prevent
    this.securityPatterns = [
      // Directory traversal
      /\.\./g,
      /\.\//g,
      /\.\\/g,
      
      // SQL injection patterns
      /union|select|insert|update|delete|drop|create|alter|exec/i,
      /or\s+\d+=\d+|and\s+\d+=\d+/i,
      /'/g,
      /"/g,
      /;/g,
      
      // XSS patterns
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      
      // Path injection
      /[\/\\]/g,
      
      // Null bytes
      /\0/g,
      
      // Control characters
      /[\x00-\x1f\x7f-\x9f]/g,
      
      // Unicode direction override (security)
      /[\u202a-\u202e\u2066-\u2069]/g
    ];

    // Slug generation options
    this.defaultOptions = {
      maxLength: 100,
      minLength: 3,
      allowNumbers: true,
      preserveCase: false,
      removeStopWords: true,
      separator: '-',
      prefix: null,
      suffix: null,
      ensureUnique: true,
      fallbackPattern: 'slug-{timestamp}-{random}'
    };
  }

  /**
   * Generate SEO-friendly slug from text
   * @param {string} text - Input text to convert
   * @param {Object} options - Generation options
   * @param {Object} context - Context for security logging
   * @returns {Object} - Generation result
   */
  generateSlug(text, options = {}, context = {}) {
    try {
      const config = { ...this.defaultOptions, ...options };
      
      console.log(`🔗 Generating slug from: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

      // Step 1: Security validation
      const securityCheck = this.validateSecurity(text, context);
      if (!securityCheck.safe) {
        console.warn('🚨 Security issues detected in slug text');
        
        logSecurityEvent(context, 'UNSAFE_SLUG_TEXT', {
          originalText: text.substring(0, 100),
          threats: securityCheck.threats,
          severity: 'medium'
        });

        // Use fallback pattern for security
        return this.generateFallbackSlug(config, 'security-fallback');
      }

      // Step 2: Initial cleaning and normalization
      let slug = this.normalizeText(text);

      // Step 3: Character mapping and transliteration
      slug = this.transliterateText(slug);

      // Step 4: Remove stopwords (if enabled)
      if (config.removeStopWords) {
        slug = this.removeStopWords(slug);
      }

      // Step 5: Apply formatting rules
      slug = this.formatSlug(slug, config);

      // Step 6: Length validation and trimming
      slug = this.validateLength(slug, config);

      // Step 7: Reserved pattern checking
      if (this.isReservedPattern(slug)) {
        console.warn(`⚠️ Generated slug "${slug}" matches reserved pattern`);
        slug = this.resolveReservedPattern(slug, config);
      }

      // Step 8: Final validation
      const validation = this.validateFinalSlug(slug, config);
      if (!validation.valid) {
        console.warn(`⚠️ Final slug validation failed: ${validation.reason}`);
        return this.generateFallbackSlug(config, validation.reason);
      }

      // Step 9: Add prefix/suffix if specified
      slug = this.addPrefixSuffix(slug, config);

      // Step 10: Generate metadata
      const metadata = this.generateMetadata(text, slug, config);

      console.log(`✅ Slug generated successfully: "${slug}"`);

      return {
        success: true,
        slug: slug,
        original: text,
        metadata: metadata,
        seoScore: this.calculateSEOScore(slug, text),
        warnings: securityCheck.warnings || []
      };

    } catch (error) {
      console.error('💥 Slug generation error:', error.message);

      logSecurityEvent(context, 'SLUG_GENERATION_ERROR', {
        originalText: text ? text.substring(0, 100) : 'null',
        error: error.message,
        severity: 'low'
      });

      return this.generateFallbackSlug(options, 'generation-error');
    }
  }

  /**
   * Validate text for security issues
   * @param {string} text - Text to validate
   * @param {Object} context - Context for logging
   * @returns {Object} - Security validation result
   */
  validateSecurity(text, context) {
    try {
      const threats = [];
      const warnings = [];

      if (!text || typeof text !== 'string') {
        threats.push({
          type: 'INVALID_INPUT',
          message: 'Invalid or empty input text',
          severity: 'medium'
        });
        return { safe: false, threats, warnings };
      }

      // Check for security patterns
      for (const pattern of this.securityPatterns) {
        if (pattern.test(text)) {
          threats.push({
            type: 'SECURITY_PATTERN_DETECTED',
            pattern: pattern.toString(),
            message: 'Potentially dangerous pattern detected',
            severity: 'high'
          });
        }
      }

      // Check for excessive length (potential DoS)
      if (text.length > 1000) {
        warnings.push({
          type: 'EXCESSIVE_LENGTH',
          message: 'Input text is very long',
          length: text.length,
          severity: 'medium'
        });
      }

      // Check for unusual character patterns
      const unusualChars = /[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g;
      const unusualMatches = text.match(unusualChars);
      if (unusualMatches && unusualMatches.length > text.length * 0.3) {
        warnings.push({
          type: 'UNUSUAL_CHARACTERS',
          message: 'High percentage of unusual characters',
          percentage: Math.round((unusualMatches.length / text.length) * 100),
          severity: 'low'
        });
      }

      return {
        safe: threats.length === 0,
        threats,
        warnings
      };

    } catch (error) {
      console.error('💥 Security validation error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'VALIDATION_ERROR', message: error.message, severity: 'medium' }],
        warnings: []
      };
    }
  }

  /**
   * Normalize text for slug generation
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  normalizeText(text) {
    try {
      // Convert to string and trim
      let normalized = String(text).trim();

      // Normalize Unicode (NFD - Canonical Decomposition)
      normalized = normalized.normalize('NFD');

      // Remove zero-width and control characters
      normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');

      // Convert multiple whitespace to single space
      normalized = normalized.replace(/\s+/g, ' ');

      // Remove leading/trailing whitespace again
      normalized = normalized.trim();

      return normalized;

    } catch (error) {
      console.error('💥 Text normalization error:', error.message);
      return text || '';
    }
  }

  /**
   * Transliterate text using character mappings
   * @param {string} text - Text to transliterate
   * @returns {string} - Transliterated text
   */
  transliterateText(text) {
    try {
      let transliterated = text;

      // Apply character mappings
      for (const [original, replacement] of Object.entries(this.characterMappings)) {
        const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        transliterated = transliterated.replace(regex, replacement);
      }

      // Remove remaining diacritics
      transliterated = transliterated.replace(/[\u0300-\u036f]/g, '');

      return transliterated;

    } catch (error) {
      console.error('💥 Transliteration error:', error.message);
      return text;
    }
  }

  /**
   * Remove stopwords from text
   * @param {string} text - Text to process
   * @returns {string} - Text without stopwords
   */
  removeStopWords(text) {
    try {
      const words = text.toLowerCase().split(/\s+/);
      const filteredWords = words.filter(word => {
        // Keep words that are not stopwords and have meaningful content
        const cleanWord = word.replace(/[^\w]/g, '');
        return cleanWord.length > 0 && !this.stopWords.has(cleanWord);
      });

      // If all words were removed, keep the original to avoid empty slug
      if (filteredWords.length === 0) {
        return text;
      }

      return filteredWords.join(' ');

    } catch (error) {
      console.error('💥 Stopword removal error:', error.message);
      return text;
    }
  }

  /**
   * Format slug according to configuration
   * @param {string} text - Text to format
   * @param {Object} config - Configuration options
   * @returns {string} - Formatted slug
   */
  formatSlug(text, config) {
    try {
      let formatted = text;

      // Convert to lowercase unless preserveCase is true
      if (!config.preserveCase) {
        formatted = formatted.toLowerCase();
      }

      // Remove non-alphanumeric characters (keep spaces for now)
      if (config.allowNumbers) {
        formatted = formatted.replace(/[^\w\s]/g, '');
      } else {
        formatted = formatted.replace(/[^\w\s]|[\d]/g, '');
      }

      // Replace spaces and multiple separators with single separator
      const separatorRegex = new RegExp(`[\\s${config.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+`, 'g');
      formatted = formatted.replace(separatorRegex, config.separator);

      // Remove leading and trailing separators
      const trimRegex = new RegExp(`^[${config.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+|[${config.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`, 'g');
      formatted = formatted.replace(trimRegex, '');

      return formatted;

    } catch (error) {
      console.error('💥 Slug formatting error:', error.message);
      return text;
    }
  }

  /**
   * Validate and adjust slug length
   * @param {string} slug - Slug to validate
   * @param {Object} config - Configuration options
   * @returns {string} - Length-validated slug
   */
  validateLength(slug, config) {
    try {
      // Truncate if too long
      if (slug.length > config.maxLength) {
        // Try to truncate at word boundary
        const truncated = slug.substring(0, config.maxLength);
        const lastSeparator = truncated.lastIndexOf(config.separator);
        
        if (lastSeparator > config.minLength) {
          slug = truncated.substring(0, lastSeparator);
        } else {
          slug = truncated;
        }
      }

      return slug;

    } catch (error) {
      console.error('💥 Length validation error:', error.message);
      return slug;
    }
  }

  /**
   * Check if slug matches reserved pattern
   * @param {string} slug - Slug to check
   * @returns {boolean} - Whether slug is reserved
   */
  isReservedPattern(slug) {
    try {
      const cleanSlug = slug.toLowerCase().replace(/[-_]/g, '');
      return this.reservedPatterns.has(cleanSlug);

    } catch (error) {
      console.error('💥 Reserved pattern check error:', error.message);
      return false;
    }
  }

  /**
   * Resolve reserved pattern conflicts
   * @param {string} slug - Conflicting slug
   * @param {Object} config - Configuration options
   * @returns {string} - Resolved slug
   */
  resolveReservedPattern(slug, config) {
    try {
      // Add suffix to make it unique
      const timestamp = Date.now().toString().slice(-6);
      return `${slug}${config.separator}${timestamp}`;

    } catch (error) {
      console.error('💥 Reserved pattern resolution error:', error.message);
      return slug;
    }
  }

  /**
   * Validate final slug
   * @param {string} slug - Slug to validate
   * @param {Object} config - Configuration options
   * @returns {Object} - Validation result
   */
  validateFinalSlug(slug, config) {
    try {
      // Check minimum length
      if (slug.length < config.minLength) {
        return {
          valid: false,
          reason: 'too-short',
          message: `Slug is too short (${slug.length} < ${config.minLength})`
        };
      }

      // Check if slug is empty or only separators
      const withoutSeparators = slug.replace(new RegExp(config.separator, 'g'), '');
      if (withoutSeparators.length === 0) {
        return {
          valid: false,
          reason: 'empty-content',
          message: 'Slug contains no meaningful content'
        };
      }

      // Check for valid characters only
      const validPattern = config.allowNumbers ? /^[a-zA-Z0-9\-_]+$/ : /^[a-zA-Z\-_]+$/;
      if (!validPattern.test(slug)) {
        return {
          valid: false,
          reason: 'invalid-characters',
          message: 'Slug contains invalid characters'
        };
      }

      return { valid: true };

    } catch (error) {
      console.error('💥 Final validation error:', error.message);
      return {
        valid: false,
        reason: 'validation-error',
        message: error.message
      };
    }
  }

  /**
   * Add prefix and suffix to slug
   * @param {string} slug - Base slug
   * @param {Object} config - Configuration options
   * @returns {string} - Slug with prefix/suffix
   */
  addPrefixSuffix(slug, config) {
    try {
      let result = slug;

      if (config.prefix) {
        const cleanPrefix = this.formatSlug(config.prefix, config);
        result = `${cleanPrefix}${config.separator}${result}`;
      }

      if (config.suffix) {
        const cleanSuffix = this.formatSlug(config.suffix, config);
        result = `${result}${config.separator}${cleanSuffix}`;
      }

      return result;

    } catch (error) {
      console.error('💥 Prefix/suffix addition error:', error.message);
      return slug;
    }
  }

  /**
   * Generate fallback slug when generation fails
   * @param {Object} config - Configuration options
   * @param {string} reason - Reason for fallback
   * @returns {Object} - Fallback slug result
   */
  generateFallbackSlug(config, reason = 'unknown') {
    try {
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(4).toString('hex');
      
      let fallback = config.fallbackPattern || this.defaultOptions.fallbackPattern;
      fallback = fallback.replace('{timestamp}', timestamp);
      fallback = fallback.replace('{random}', randomString);
      fallback = fallback.replace('{reason}', reason);

      console.log(`🔄 Generated fallback slug: "${fallback}" (reason: ${reason})`);

      return {
        success: true,
        slug: fallback,
        original: null,
        fallback: true,
        fallbackReason: reason,
        metadata: {
          timestamp: timestamp,
          random: randomString,
          reason: reason
        },
        seoScore: 20, // Low SEO score for fallback
        warnings: [{
          type: 'FALLBACK_USED',
          message: `Fallback slug generated due to: ${reason}`,
          severity: 'medium'
        }]
      };

    } catch (error) {
      console.error('💥 Fallback generation error:', error.message);
      
      // Ultimate fallback
      const simpleTimestamp = Date.now();
      return {
        success: true,
        slug: `slug-${simpleTimestamp}`,
        original: null,
        fallback: true,
        fallbackReason: 'generation-error',
        metadata: { timestamp: simpleTimestamp },
        seoScore: 10,
        warnings: []
      };
    }
  }

  /**
   * Generate metadata for the slug
   * @param {string} originalText - Original input text
   * @param {string} slug - Generated slug
   * @param {Object} config - Configuration options
   * @returns {Object} - Metadata object
   */
  generateMetadata(originalText, slug, config) {
    try {
      const metadata = {
        timestamp: new Date().toISOString(),
        originalLength: originalText.length,
        slugLength: slug.length,
        reductionRatio: Math.round((1 - (slug.length / originalText.length)) * 100),
        wordCount: originalText.split(/\s+/).length,
        slugWordCount: slug.split(config.separator).length,
        hasNumbers: /\d/.test(slug),
        separatorCount: (slug.match(new RegExp(config.separator, 'g')) || []).length,
        estimatedReadability: this.calculateReadability(slug),
        seoKeywords: this.extractKeywords(originalText, slug)
      };

      return metadata;

    } catch (error) {
      console.error('💥 Metadata generation error:', error.message);
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Calculate SEO score for the slug
   * @param {string} slug - Generated slug
   * @param {string} originalText - Original text
   * @returns {number} - SEO score (0-100)
   */
  calculateSEOScore(slug, originalText) {
    try {
      let score = 100;

      // Length penalty/bonus
      if (slug.length < 20) score -= 10; // Too short
      if (slug.length > 60) score -= 15; // Too long
      if (slug.length >= 30 && slug.length <= 50) score += 10; // Optimal length

      // Word count bonus
      const wordCount = slug.split('-').length;
      if (wordCount >= 2 && wordCount <= 5) score += 15;
      if (wordCount > 8) score -= 20;

      // Keyword preservation
      const originalWords = originalText.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      const slugWords = slug.split('-');
      const preservedWords = originalWords.filter(word => 
        slugWords.some(slugWord => slugWord.includes(word.substring(0, 4)))
      );
      const preservationRatio = preservedWords.length / Math.max(originalWords.length, 1);
      score += Math.round(preservationRatio * 20);

      // Readability bonus
      if (!/\d{4,}/.test(slug)) score += 5; // No long numbers
      if (!/[-]{2,}/.test(slug)) score += 5; // No multiple separators
      if (/^[a-z]/.test(slug)) score += 5; // Starts with letter

      // Penalty for fallback patterns
      if (slug.includes('slug-') && /\d{10,}/.test(slug)) score -= 30;

      return Math.max(0, Math.min(100, score));

    } catch (error) {
      console.error('💥 SEO score calculation error:', error.message);
      return 50; // Default medium score
    }
  }

  /**
   * Calculate readability score for slug
   * @param {string} slug - Slug to analyze
   * @returns {number} - Readability score (0-100)
   */
  calculateReadability(slug) {
    try {
      let score = 100;

      // Penalty for numbers
      const numberCount = (slug.match(/\d/g) || []).length;
      score -= numberCount * 2;

      // Penalty for long words
      const words = slug.split('-');
      const longWords = words.filter(word => word.length > 8);
      score -= longWords.length * 5;

      // Bonus for common English patterns
      const commonPatterns = /^(the|how|what|why|when|where|best|top|guide|tips)/;
      if (commonPatterns.test(slug)) score += 10;

      return Math.max(0, Math.min(100, score));

    } catch (error) {
      console.error('💥 Readability calculation error:', error.message);
      return 50;
    }
  }

  /**
   * Extract keywords from original text and slug
   * @param {string} originalText - Original text
   * @param {string} slug - Generated slug
   * @returns {Array} - Array of keywords
   */
  extractKeywords(originalText, slug) {
    try {
      const originalWords = originalText.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.stopWords.has(word))
        .slice(0, 10);

      const slugWords = slug.split('-').filter(word => word.length > 2);

      return {
        original: originalWords,
        preserved: slugWords,
        coverage: Math.round((slugWords.length / Math.max(originalWords.length, 1)) * 100)
      };

    } catch (error) {
      console.error('💥 Keyword extraction error:', error.message);
      return { original: [], preserved: [], coverage: 0 };
    }
  }

  /**
   * Generate unique slug by checking against existing slugs
   * @param {string} baseSlug - Base slug to make unique
   * @param {Function} checkExists - Function to check if slug exists
   * @param {Object} config - Configuration options
   * @returns {Promise<string>} - Unique slug
   */
  async ensureUnique(baseSlug, checkExists, config = {}) {
    try {
      const maxAttempts = 100;
      let currentSlug = baseSlug;
      let counter = 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const exists = await checkExists(currentSlug);
        
        if (!exists) {
          console.log(`✅ Unique slug found: "${currentSlug}" (attempt ${attempt + 1})`);
          return currentSlug;
        }

        // Generate next variation
        const separator = config.separator || '-';
        currentSlug = `${baseSlug}${separator}${counter}`;
        counter++;
      }

      // If we couldn't find a unique slug, add timestamp
      const timestamp = Date.now().toString().slice(-6);
      const fallbackSlug = `${baseSlug}${config.separator || '-'}${timestamp}`;
      
      console.warn(`⚠️ Could not find unique slug after ${maxAttempts} attempts, using timestamp: "${fallbackSlug}"`);
      return fallbackSlug;

    } catch (error) {
      console.error('💥 Unique slug generation error:', error.message);
      
      // Emergency fallback
      const timestamp = Date.now();
      return `${baseSlug}-${timestamp}`;
    }
  }

  /**
   * Batch generate slugs for multiple texts
   * @param {Array} texts - Array of texts to convert
   * @param {Object} options - Generation options
   * @param {Object} context - Context for logging
   * @returns {Array} - Array of generation results
   */
  generateBatch(texts, options = {}, context = {}) {
    try {
      console.log(`🔗 Batch generating ${texts.length} slugs`);

      const results = [];
      const errors = [];

      for (let i = 0; i < texts.length; i++) {
        try {
          const result = this.generateSlug(texts[i], {
            ...options,
            batchIndex: i
          }, {
            ...context,
            batchOperation: true,
            itemIndex: i
          });

          results.push(result);

        } catch (error) {
          console.error(`💥 Batch item ${i} error:`, error.message);
          
          errors.push({
            index: i,
            text: texts[i],
            error: error.message
          });

          // Add fallback result
          results.push(this.generateFallbackSlug(options, `batch-error-${i}`));
        }
      }

      console.log(`✅ Batch generation complete: ${results.length - errors.length}/${texts.length} successful`);

      return {
        success: errors.length === 0,
        results,
        errors,
        statistics: {
          total: texts.length,
          successful: results.length - errors.length,
          failed: errors.length,
          averageSEOScore: results.reduce((sum, r) => sum + (r.seoScore || 0), 0) / results.length
        }
      };

    } catch (error) {
      console.error('💥 Batch generation error:', error.message);
      return {
        success: false,
        results: [],
        errors: [{ error: error.message }],
        statistics: { total: 0, successful: 0, failed: texts.length }
      };
    }
  }
}

// Create singleton instance
const slugGenerator = new SlugGenerator();

module.exports = {
  generateSlug: (text, options, context) => 
    slugGenerator.generateSlug(text, options, context),
  
  ensureUnique: (baseSlug, checkExists, config) => 
    slugGenerator.ensureUnique(baseSlug, checkExists, config),
  
  generateBatch: (texts, options, context) => 
    slugGenerator.generateBatch(texts, options, context),
  
  // Export the class for advanced usage
  SlugGenerator
};