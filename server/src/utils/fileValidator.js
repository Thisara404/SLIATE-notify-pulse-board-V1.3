// File Validator - Comprehensive file security validation
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logSecurityEvent } = require('../middleware/logging');

class FileValidator {
  constructor() {
    // File type configurations
    this.fileTypes = {
      // Image file configurations
      images: {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'],
        mimeTypes: [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
          'image/webp', 'image/bmp', 'image/svg+xml'
        ],
        maxSize: 5 * 1024 * 1024, // 5MB
        allowExecutable: false,
        scanForMalware: true,
        checkMagicBytes: true
      },

      // Document file configurations
      documents: {
        extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods'],
        mimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'application/rtf',
          'application/vnd.oasis.opendocument.text',
          'application/vnd.oasis.opendocument.spreadsheet'
        ],
        maxSize: 10 * 1024 * 1024, // 10MB
        allowExecutable: false,
        scanForMalware: true,
        checkMagicBytes: true
      },

      // Archive file configurations
      archives: {
        extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
        mimeTypes: [
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
          'application/x-tar',
          'application/gzip'
        ],
        maxSize: 20 * 1024 * 1024, // 20MB
        allowExecutable: false,
        scanForMalware: true,
        checkMagicBytes: true,
        maxDepth: 3 // For archive scanning
      }
    };

    // File magic bytes (file signatures)
    this.magicBytes = {
      // Image formats
      'image/jpeg': [
        [0xFF, 0xD8, 0xFF],
        [0xFF, 0xD8, 0xFF, 0xE0],
        [0xFF, 0xD8, 0xFF, 0xE1]
      ],
      'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      'image/gif': [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
      ],
      'image/webp': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
      'image/bmp': [[0x42, 0x4D]],

      // Document formats
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
      'application/zip': [
        [0x50, 0x4B, 0x03, 0x04], // PK..
        [0x50, 0x4B, 0x05, 0x06], // PK..
        [0x50, 0x4B, 0x07, 0x08]  // PK..
      ],

      // Executable formats (dangerous)
      'application/x-executable': [
        [0x4D, 0x5A], // MZ (Windows PE)
        [0x7F, 0x45, 0x4C, 0x46], // ELF (Linux)
        [0xFE, 0xED, 0xFA, 0xCE], // Mach-O (macOS)
        [0xFE, 0xED, 0xFA, 0xCF], // Mach-O 64-bit
        [0xCA, 0xFE, 0xBA, 0xBE], // Java class
        [0x4C, 0x00, 0x00, 0x00], // Windows LNK
        [0x00, 0x00, 0x01, 0x00]  // ICO file
      ]
    };

    // Dangerous file patterns
    this.dangerousPatterns = [
      // Executable extensions
      /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|app|deb|rpm|dmg|pkg)$/i,
      
      // Script files
      /\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh)$/i,
      
      // Double extensions
      /\.\w+\.(exe|bat|cmd|com|pif|scr|vbs|js)$/i,
      
      // Hidden files (Unix)
      /^\..*$/,
      
      // System files
      /^(autorun\.inf|desktop\.ini|thumbs\.db)$/i,
      
      // Suspicious names
      /(virus|malware|trojan|backdoor|keylogger|rootkit)/i
    ];

    // Content scanning patterns for embedded threats
    this.maliciousPatterns = [
      // JavaScript in files
      /<script[\s\S]*?<\/script>/gi,
      /javascript\s*:/gi,
      
      // PHP code
      /<\?php[\s\S]*?\?>/gi,
      /<\?[\s\S]*?\?>/gi,
      
      // Shell commands
      /system\s*\(/gi,
      /exec\s*\(/gi,
      /passthru\s*\(/gi,
      /shell_exec\s*\(/gi,
      
      // SQL injection in files
      /(union|select|insert|update|delete|drop)\s+/gi,
      
      // Suspicious URLs
      /https?:\/\/[^\s]*\.(exe|bat|cmd|com|pif|scr|vbs|js)/gi,
      
      // Base64 encoded executables
      /TVqQAAMAAAAEAAAA/g, // MZ header in base64
      
      // Suspicious PowerShell
      /powershell\s+-/gi,
      /invoke-expression/gi,
      /downloadstring/gi
    ];
  }

  /**
   * Validate uploaded file comprehensively
   * @param {Object} file - File object (from multer)
   * @param {string} category - File category (images, documents, archives)
   * @param {Object} context - Context information
   * @returns {Object} - Validation result
   */
  async validateFile(file, category = 'documents', context = {}) {
    try {
      console.log(`📁 Validating file: ${file.originalname} (${file.size} bytes)`);

      const threats = [];
      const warnings = [];
      const config = this.fileTypes[category];

      if (!config) {
        return {
          safe: false,
          error: `Unknown file category: ${category}`,
          threats: [],
          warnings: []
        };
      }

      // Step 1: Basic file information validation
      const basicValidation = await this.validateBasicInfo(file, config);
      if (!basicValidation.safe) {
        threats.push(...basicValidation.threats);
      }
      warnings.push(...basicValidation.warnings);

      // Step 2: File extension validation
      const extensionValidation = this.validateExtension(file, config);
      if (!extensionValidation.safe) {
        threats.push(...extensionValidation.threats);
      }

      // Step 3: MIME type validation
      const mimeValidation = this.validateMimeType(file, config);
      if (!mimeValidation.safe) {
        threats.push(...mimeValidation.threats);
      }

      // Step 4: File size validation
      const sizeValidation = this.validateFileSize(file, config);
      if (!sizeValidation.safe) {
        threats.push(...sizeValidation.threats);
      }

      // Step 5: Magic bytes validation
      if (config.checkMagicBytes) {
        const magicValidation = await this.validateMagicBytes(file);
        if (!magicValidation.safe) {
          threats.push(...magicValidation.threats);
        }
      }

      // Step 6: Content scanning for malware
      if (config.scanForMalware) {
        const contentValidation = await this.scanFileContent(file);
        if (!contentValidation.safe) {
          threats.push(...contentValidation.threats);
        }
      }

      // Step 7: Dangerous pattern checking
      const patternValidation = this.checkDangerousPatterns(file);
      if (!patternValidation.safe) {
        threats.push(...patternValidation.threats);
      }

      // Step 8: File integrity check
      const integrityCheck = await this.checkFileIntegrity(file);
      warnings.push(...integrityCheck.warnings);

      const isSafe = threats.length === 0;
      const riskScore = this.calculateRiskScore(threats, warnings);

      // Log security events
      if (!isSafe) {
        logSecurityEvent(context, 'UNSAFE_FILE_UPLOAD', {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          category: category,
          threats: threats.map(t => ({ type: t.type, severity: t.severity })),
          threatCount: threats.length,
          riskScore: riskScore,
          severity: this.calculateThreatSeverity(threats)
        });
      }

      console.log(`${isSafe ? '✅' : '🚨'} File validation complete. Risk score: ${riskScore}/100`);

      return {
        safe: isSafe,
        threats,
        warnings,
        riskScore,
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          extension: path.extname(file.originalname).toLowerCase(),
          category: category
        },
        securityAnalysis: {
          threatLevel: this.calculateThreatSeverity(threats),
          riskFactors: threats.length + warnings.length,
          safeForPublic: isSafe && riskScore < 30
        }
      };

    } catch (error) {
      console.error('💥 File validation error:', error.message);

      logSecurityEvent(context, 'FILE_VALIDATION_ERROR', {
        filename: file?.originalname || 'unknown',
        error: error.message,
        severity: 'medium'
      });

      return {
        safe: false,
        error: 'File validation failed due to internal error',
        threats: [{ type: 'VALIDATION_ERROR', severity: 'medium' }],
        warnings: []
      };
    }
  }

  /**
   * Validate basic file information
   * @param {Object} file - File object
   * @param {Object} config - File type configuration
   * @returns {Object} - Validation result
   */
  async validateBasicInfo(file, config) {
    const threats = [];
    const warnings = [];

    try {
      // Check if file exists
      if (!file || !file.originalname) {
        threats.push({
          type: 'MISSING_FILE_INFO',
          message: 'File information is missing',
          severity: 'high'
        });
        return { safe: false, threats, warnings };
      }

      // Check for null bytes in filename (directory traversal attempt)
      if (file.originalname.includes('\0')) {
        threats.push({
          type: 'NULL_BYTE_FILENAME',
          message: 'Filename contains null bytes',
          severity: 'critical'
        });
      }

      // Check for path traversal in filename
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        threats.push({
          type: 'PATH_TRAVERSAL_FILENAME',
          message: 'Filename contains path traversal characters',
          severity: 'critical'
        });
      }

      // Check filename length
      if (file.originalname.length > 255) {
        warnings.push({
          type: 'LONG_FILENAME',
          message: 'Filename is unusually long',
          severity: 'medium'
        });
      }

      // Check for unusual characters in filename
      const unusualChars = /[<>:"|?*\x00-\x1f\x7f-\x9f]/;
      if (unusualChars.test(file.originalname)) {
        threats.push({
          type: 'UNUSUAL_FILENAME_CHARS',
          message: 'Filename contains unusual or dangerous characters',
          severity: 'medium'
        });
      }

      return {
        safe: threats.length === 0,
        threats,
        warnings
      };

    } catch (error) {
      console.error('💥 Basic info validation error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'BASIC_VALIDATION_ERROR', severity: 'medium' }],
        warnings: []
      };
    }
  }

  /**
   * Validate file extension
   * @param {Object} file - File object
   * @param {Object} config - File type configuration
   * @returns {Object} - Validation result
   */
  validateExtension(file, config) {
    const threats = [];
    
    try {
      const extension = path.extname(file.originalname).toLowerCase();

      // Check if extension is allowed
      if (!config.extensions.includes(extension)) {
        threats.push({
          type: 'INVALID_EXTENSION',
          message: `File extension ${extension} is not allowed`,
          severity: 'high',
          extension: extension
        });
      }

      // Check for double extensions (e.g., .txt.exe)
      const doubleExtensionPattern = /\.\w+\.\w+$/;
      if (doubleExtensionPattern.test(file.originalname)) {
        threats.push({
          type: 'DOUBLE_EXTENSION',
          message: 'File has multiple extensions (potential disguise)',
          severity: 'high'
        });
      }

      // Check for executable extensions
      const executablePattern = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|app)$/i;
      if (executablePattern.test(file.originalname)) {
        threats.push({
          type: 'EXECUTABLE_EXTENSION',
          message: 'File has executable extension',
          severity: 'critical'
        });
      }

      return {
        safe: threats.length === 0,
        threats
      };

    } catch (error) {
      console.error('💥 Extension validation error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'EXTENSION_VALIDATION_ERROR', severity: 'medium' }]
      };
    }
  }

  /**
   * Validate MIME type
   * @param {Object} file - File object
   * @param {Object} config - File type configuration
   * @returns {Object} - Validation result
   */
  validateMimeType(file, config) {
    const threats = [];

    try {
      // Check if MIME type is allowed
      if (!config.mimeTypes.includes(file.mimetype)) {
        threats.push({
          type: 'INVALID_MIME_TYPE',
          message: `MIME type ${file.mimetype} is not allowed`,
          severity: 'high',
          mimetype: file.mimetype
        });
      }

      // Check for dangerous MIME types
      const dangerousMimes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'application/x-dosexec',
        'application/javascript',
        'text/javascript',
        'application/x-httpd-php',
        'text/x-php'
      ];

      if (dangerousMimes.includes(file.mimetype)) {
        threats.push({
          type: 'DANGEROUS_MIME_TYPE',
          message: `Dangerous MIME type detected: ${file.mimetype}`,
          severity: 'critical',
          mimetype: file.mimetype
        });
      }

      // Check for MIME type spoofing (extension vs MIME mismatch)
      const extension = path.extname(file.originalname).toLowerCase();
      const expectedMimes = this.getExpectedMimeTypes(extension);
      
      if (expectedMimes.length > 0 && !expectedMimes.includes(file.mimetype)) {
        threats.push({
          type: 'MIME_EXTENSION_MISMATCH',
          message: `MIME type ${file.mimetype} doesn't match extension ${extension}`,
          severity: 'medium',
          extension: extension,
          mimetype: file.mimetype
        });
      }

      return {
        safe: threats.length === 0,
        threats
      };

    } catch (error) {
      console.error('💥 MIME type validation error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'MIME_VALIDATION_ERROR', severity: 'medium' }]
      };
    }
  }

  /**
   * Validate file size
   * @param {Object} file - File object
   * @param {Object} config - File type configuration
   * @returns {Object} - Validation result
   */
  validateFileSize(file, config) {
    const threats = [];

    try {
      // Check if file size exceeds limit
      if (file.size > config.maxSize) {
        threats.push({
          type: 'FILE_TOO_LARGE',
          message: `File size ${file.size} bytes exceeds limit of ${config.maxSize} bytes`,
          severity: 'medium',
          fileSize: file.size,
          maxSize: config.maxSize
        });
      }

      // Check for suspiciously small files
      if (file.size < 10) {
        threats.push({
          type: 'SUSPICIOUSLY_SMALL_FILE',
          message: 'File is suspiciously small (potential empty or malformed file)',
          severity: 'low',
          fileSize: file.size
        });
      }

      // Check for zero-byte files
      if (file.size === 0) {
        threats.push({
          type: 'ZERO_BYTE_FILE',
          message: 'File is empty (zero bytes)',
          severity: 'medium'
        });
      }

      return {
        safe: threats.length === 0,
        threats
      };

    } catch (error) {
      console.error('💥 File size validation error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'SIZE_VALIDATION_ERROR', severity: 'medium' }]
      };
    }
  }

  /**
   * Validate file magic bytes (file signature)
   * @param {Object} file - File object
   * @returns {Object} - Validation result
   */
  async validateMagicBytes(file) {
    const threats = [];

    try {
      // Read first 16 bytes of the file
      const buffer = await fs.readFile(file.path);
      const fileHeader = Array.from(buffer.slice(0, 16));

      // Check against known magic bytes
      let foundValidSignature = false;
      const expectedSignatures = this.magicBytes[file.mimetype] || [];

      for (const signature of expectedSignatures) {
        if (this.matchesMagicBytes(fileHeader, signature)) {
          foundValidSignature = true;
          break;
        }
      }

      // If we have expected signatures but none match
      if (expectedSignatures.length > 0 && !foundValidSignature) {
        threats.push({
          type: 'MAGIC_BYTES_MISMATCH',
          message: `File signature doesn't match declared MIME type ${file.mimetype}`,
          severity: 'high',
          mimetype: file.mimetype,
          fileHeader: fileHeader.slice(0, 8).map(b => '0x' + b.toString(16)).join(' ')
        });
      }

      // Check for executable signatures
      const executableSignatures = this.magicBytes['application/x-executable'] || [];
      for (const signature of executableSignatures) {
        if (this.matchesMagicBytes(fileHeader, signature)) {
          threats.push({
            type: 'EXECUTABLE_FILE_DETECTED',
            message: 'File contains executable signature',
            severity: 'critical',
            signature: signature.map(b => b !== null ? '0x' + b.toString(16) : 'XX').join(' ')
          });
          break;
        }
      }

      return {
        safe: threats.length === 0,
        threats
      };

    } catch (error) {
      console.error('💥 Magic bytes validation error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'MAGIC_BYTES_ERROR', severity: 'medium' }]
      };
    }
  }

  /**
   * Scan file content for malicious patterns
   * @param {Object} file - File object
   * @returns {Object} - Validation result
   */
  async scanFileContent(file) {
    const threats = [];

    try {
      // Read file content (limit to first 1MB for performance)
      const buffer = await fs.readFile(file.path);
      const maxScanSize = Math.min(buffer.length, 1024 * 1024);
      const content = buffer.slice(0, maxScanSize).toString('utf-8', { fatal: false });

      // Scan for malicious patterns
      for (let i = 0; i < this.maliciousPatterns.length; i++) {
        const pattern = this.maliciousPatterns[i];
        const matches = content.match(pattern);

        if (matches) {
          threats.push({
            type: 'MALICIOUS_CONTENT_DETECTED',
            pattern: pattern.toString(),
            matches: matches.slice(0, 3), // Show first 3 matches
            severity: 'critical',
            description: 'File contains potentially malicious content'
          });
        }
      }

      // Check for embedded files (ZIP in image, etc.)
      if (this.containsEmbeddedArchive(buffer)) {
        threats.push({
          type: 'EMBEDDED_ARCHIVE',
          message: 'File contains embedded archive (polyglot file)',
          severity: 'high'
        });
      }

      // Check for unusual entropy (possible encrypted/obfuscated content)
      const entropy = this.calculateEntropy(buffer.slice(0, 1024));
      if (entropy > 7.5) {
        threats.push({
          type: 'HIGH_ENTROPY',
          message: 'File has unusually high entropy (possible encryption/obfuscation)',
          severity: 'medium',
          entropy: entropy
        });
      }

      return {
        safe: threats.length === 0,
        threats
      };

    } catch (error) {
      console.error('💥 Content scanning error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'CONTENT_SCAN_ERROR', severity: 'medium' }]
      };
    }
  }

  /**
   * Check for dangerous filename patterns
   * @param {Object} file - File object
   * @returns {Object} - Validation result
   */
  checkDangerousPatterns(file) {
    const threats = [];

    try {
      // Check against dangerous patterns
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(file.originalname)) {
          threats.push({
            type: 'DANGEROUS_FILENAME_PATTERN',
            pattern: pattern.toString(),
            message: 'Filename matches dangerous pattern',
            severity: 'high',
            filename: file.originalname
          });
        }
      }

      return {
        safe: threats.length === 0,
        threats
      };

    } catch (error) {
      console.error('💥 Pattern checking error:', error.message);
      return {
        safe: false,
        threats: [{ type: 'PATTERN_CHECK_ERROR', severity: 'medium' }]
      };
    }
  }

  /**
   * Check file integrity
   * @param {Object} file - File object
   * @returns {Object} - Check result
   */
  async checkFileIntegrity(file) {
    const warnings = [];

    try {
      // Calculate file hash
      const buffer = await fs.readFile(file.path);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Store hash for future reference
      file.sha256 = hash;

      // Check for suspicious file sizes vs content
      const actualSize = buffer.length;
      if (actualSize !== file.size) {
        warnings.push({
          type: 'SIZE_MISMATCH',
          message: 'Reported file size doesn\'t match actual size',
          severity: 'medium',
          reportedSize: file.size,
          actualSize: actualSize
        });
      }

      return {
        warnings,
        fileHash: hash
      };

    } catch (error) {
      console.error('💥 Integrity check error:', error.message);
      return {
        warnings: [{ type: 'INTEGRITY_CHECK_ERROR', severity: 'low' }]
      };
    }
  }

  /**
   * Helper: Match magic bytes against signature
   * @param {Array} fileHeader - File header bytes
   * @param {Array} signature - Expected signature
   * @returns {boolean} - Whether signature matches
   */
  matchesMagicBytes(fileHeader, signature) {
    if (fileHeader.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== null && fileHeader[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper: Get expected MIME types for extension
   * @param {string} extension - File extension
   * @returns {Array} - Expected MIME types
   */
  getExpectedMimeTypes(extension) {
    const mimeMap = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.pdf': ['application/pdf'],
      '.txt': ['text/plain'],
      '.zip': ['application/zip'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };

    return mimeMap[extension] || [];
  }

  /**
   * Helper: Check for embedded archives in files
   * @param {Buffer} buffer - File buffer
   * @returns {boolean} - Whether embedded archive found
   */
  containsEmbeddedArchive(buffer) {
    try {
      // Look for ZIP signatures in the middle of the file
      const zipSignature = [0x50, 0x4B, 0x03, 0x04];
      
      for (let i = 100; i < buffer.length - 4; i++) {
        let match = true;
        for (let j = 0; j < zipSignature.length; j++) {
          if (buffer[i + j] !== zipSignature[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          return true;
        }
      }

      return false;

    } catch (error) {
      console.error('💥 Embedded archive check error:', error.message);
      return false;
    }
  }

  /**
   * Helper: Calculate file entropy
   * @param {Buffer} buffer - File buffer
   * @returns {number} - Entropy value
   */
  calculateEntropy(buffer) {
    try {
      const frequency = new Array(256).fill(0);
      
      // Count byte frequencies
      for (const byte of buffer) {
        frequency[byte]++;
      }

      // Calculate entropy
      let entropy = 0;
      const length = buffer.length;

      for (const count of frequency) {
        if (count > 0) {
          const probability = count / length;
          entropy -= probability * Math.log2(probability);
        }
      }

      return entropy;

    } catch (error) {
      console.error('💥 Entropy calculation error:', error.message);
      return 0;
    }
  }

  /**
   * Helper: Calculate threat severity
   * @param {Array} threats - Array of threats
   * @returns {string} - Threat level
   */
  calculateThreatSeverity(threats) {
    if (threats.length === 0) return 'none';

    const severities = threats.map(t => t.severity);
    
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Helper: Calculate risk score
   * @param {Array} threats - Array of threats
   * @param {Array} warnings - Array of warnings
   * @returns {number} - Risk score (0-100)
   */
  calculateRiskScore(threats, warnings) {
    const severityScores = {
      'critical': 40,
      'high': 25,
      'medium': 15,
      'low': 5
    };

    let score = 0;

    for (const threat of threats) {
      score += severityScores[threat.severity] || 5;
    }

    for (const warning of warnings) {
      score += (severityScores[warning.severity] || 5) * 0.5; // Warnings count as half
    }

    return Math.min(100, score);
  }
}

// Create singleton instance
const fileValidator = new FileValidator();

module.exports = {
  validateFile: (file, category, context) => 
    fileValidator.validateFile(file, category, context),
  
  // Export the class for advanced usage
  FileValidator
};