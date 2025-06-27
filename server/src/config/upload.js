// Secure file upload configuration
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const { config } = require('./environment');

class SecureUploadConfig {
  constructor() {
    this.uploadPath = config.upload.uploadPath;
    this.maxFileSize = config.upload.maxFileSize;
    this.maxImageSize = config.upload.maxImageSize;
    this.allowedImageTypes = config.upload.allowedImageTypes;
    this.allowedFileTypes = config.upload.allowedFileTypes;
    
    // Ensure upload directories exist
    this.initializeDirectories();
  }

  // Initialize upload directories with proper permissions
  async initializeDirectories() {
    try {
      const directories = [
        path.join(this.uploadPath, 'images'),
        path.join(this.uploadPath, 'files'),
        path.join(this.uploadPath, 'temp'),
        path.join(this.uploadPath, 'quarantine')
      ];

      for (const dir of directories) {
        try {
          await fs.access(dir);
          console.log(`✅ Upload directory exists: ${dir}`);
        } catch (error) {
          await fs.mkdir(dir, { recursive: true, mode: 0o755 });
          console.log(`📁 Created upload directory: ${dir}`);
        }
      }
    } catch (error) {
      console.error('💥 Error initializing upload directories:', error);
      throw error;
    }
  }

  // Secure storage configuration
  createSecureStorage() {
    return multer.diskStorage({
      destination: (req, file, callback) => {
        try {
          // Determine destination based on file type
          const isImage = this.allowedImageTypes.includes(file.mimetype);
          const destination = isImage ? 
            path.join(this.uploadPath, 'images') : 
            path.join(this.uploadPath, 'files');
          
          console.log(`📁 File destination determined: ${destination} for ${file.originalname}`);
          callback(null, destination);
        } catch (error) {
          console.error('💥 Error determining file destination:', error);
          callback(error);
        }
      },
      
      filename: (req, file, callback) => {
        try {
          // Generate secure filename
          const secureFilename = this.generateSecureFilename(file.originalname);
          
          // Store original filename in request for later reference
          if (!req.uploadedFiles) {
            req.uploadedFiles = [];
          }
          
          req.uploadedFiles.push({
            originalName: file.originalname,
            secureFilename: secureFilename,
            mimetype: file.mimetype,
            fieldname: file.fieldname
          });
          
          console.log(`🔐 Secure filename generated: ${secureFilename} for ${file.originalname}`);
          callback(null, secureFilename);
        } catch (error) {
          console.error('💥 Error generating secure filename:', error);
          callback(error);
        }
      }
    });
  }

  // Generate cryptographically secure filename
  generateSecureFilename(originalname) {
    try {
      // Sanitize original filename
      const sanitized = this.sanitizeFilename(originalname);
      
      // Extract extension
      const ext = path.extname(sanitized).toLowerCase();
      
      // Generate UUID for uniqueness
      const uuid = crypto.randomUUID();
      
      // Add timestamp for additional uniqueness
      const timestamp = Date.now();
      
      // Create secure filename: timestamp_uuid.ext
      return `${timestamp}_${uuid}${ext}`;
    } catch (error) {
      console.error('💥 Error generating secure filename:', error);
      throw new Error('Failed to generate secure filename');
    }
  }

  // Sanitize original filename
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename');
    }

    // Remove dangerous characters and normalize
    let sanitized = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace dangerous chars with underscore
      .replace(/_{2,}/g, '_')            // Replace multiple underscores with single
      .replace(/^[._-]+/, '')            // Remove leading dots, underscores, hyphens
      .replace(/[._-]+$/, '')            // Remove trailing dots, underscores, hyphens
      .substring(0, 100);                // Limit length

    // Ensure we have a valid filename
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'upload';
    }

    return sanitized;
  }

  // File filter for security validation
  createFileFilter() {
    return (req, file, callback) => {
      try {
        console.log(`🔍 Validating file: ${file.originalname} (${file.mimetype})`);
        
        // Basic security checks
        const validation = this.validateFileBasics(file);
        
        if (!validation.isValid) {
          console.error(`🚫 File validation failed: ${validation.errors.join(', ')}`);
          return callback(new Error(validation.errors[0]), false);
        }

        // Check if it's an allowed file type
        const allAllowedTypes = [...this.allowedImageTypes, ...this.allowedFileTypes];
        const isAllowed = allAllowedTypes.includes(file.mimetype);
        
        if (!isAllowed) {
          console.error(`🚫 File type not allowed: ${file.mimetype}`);
          return callback(new Error(`File type ${file.mimetype} is not allowed`), false);
        }

        // Additional security checks
        const securityCheck = this.performSecurityChecks(file);
        
        if (!securityCheck.isSafe) {
          console.error(`🚨 Security check failed: ${securityCheck.reason}`);
          return callback(new Error(securityCheck.reason), false);
        }

        console.log(`✅ File validation passed: ${file.originalname}`);
        callback(null, true);
      } catch (error) {
        console.error('💥 Error in file filter:', error);
        callback(error, false);
      }
    };
  }

  // Basic file validation
  validateFileBasics(file) {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check filename
    if (!file.originalname || file.originalname.trim() === '') {
      errors.push('File must have a name');
    }

    // Check for dangerous filenames
    const dangerousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.pif$/i,
      /\.vbs$/i,
      /\.js$/i,
      /\.jar$/i,
      /\.com$/i,
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
      /\.html?$/i,
      /\.htm$/i
    ];

    const isDangerous = dangerousPatterns.some(pattern => 
      pattern.test(file.originalname)
    );

    if (isDangerous) {
      errors.push('Potentially dangerous file type detected');
    }

    // Check for double extensions (file.pdf.exe)
    const extensionCount = (file.originalname.match(/\./g) || []).length;
    if (extensionCount > 1) {
      // Allow only specific safe double extensions
      const safeDoubleExtensions = ['.tar.gz', '.tar.bz2'];
      const hasSafeDouble = safeDoubleExtensions.some(ext => 
        file.originalname.toLowerCase().endsWith(ext)
      );
      
      if (!hasSafeDouble) {
        errors.push('Multiple file extensions not allowed');
      }
    }

    // Check mimetype
    if (!file.mimetype || file.mimetype.trim() === '') {
      errors.push('File type could not be determined');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Advanced security checks
  performSecurityChecks(file) {
    try {
      // Check for null bytes (directory traversal attempt)
      if (file.originalname.includes('\0')) {
        return {
          isSafe: false,
          reason: 'Null byte detected in filename'
        };
      }

      // Check for path traversal attempts
      const pathTraversalPatterns = [
        /\.\./,
        /\.\.\//,
        /\.\.\\/,
        /\.\.%2f/i,
        /\.\.%5c/i,
        /%2e%2e%2f/i,
        /%2e%2e%5c/i
      ];

      const hasPathTraversal = pathTraversalPatterns.some(pattern => 
        pattern.test(file.originalname)
      );

      if (hasPathTraversal) {
        return {
          isSafe: false,
          reason: 'Path traversal attempt detected'
        };
      }

      // Check for extremely long filenames (potential buffer overflow)
      if (file.originalname.length > 255) {
        return {
          isSafe: false,
          reason: 'Filename too long'
        };
      }

      // Check for reserved filenames (Windows)
      const reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
      ];

      const baseName = path.basename(file.originalname, path.extname(file.originalname));
      if (reservedNames.includes(baseName.toUpperCase())) {
        return {
          isSafe: false,
          reason: 'Reserved filename not allowed'
        };
      }

      // Check mimetype consistency
      const extension = path.extname(file.originalname).toLowerCase();
      const expectedMimetypes = this.getExpectedMimetypes(extension);
      
      if (expectedMimetypes.length > 0 && !expectedMimetypes.includes(file.mimetype)) {
        return {
          isSafe: false,
          reason: 'File extension and mimetype mismatch'
        };
      }

      return {
        isSafe: true,
        reason: 'All security checks passed'
      };
    } catch (error) {
      console.error('💥 Error in security checks:', error);
      return {
        isSafe: false,
        reason: 'Security validation failed'
      };
    }
  }

  // Get expected mimetypes for file extension
  getExpectedMimetypes(ext) {
    const mimetypeMap = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.webp': ['image/webp'],
      '.pdf': ['application/pdf'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.xls': ['application/vnd.ms-excel'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      '.txt': ['text/plain'],
      '.rtf': ['application/rtf', 'text/rtf'],
      '.zip': ['application/zip', 'application/x-zip-compressed'],
      '.odt': ['application/vnd.oasis.opendocument.text']
    };

    return mimetypeMap[ext.toLowerCase()] || [];
  }

  // Create main multer configuration
  createMulterConfig() {
    return multer({
      storage: this.createSecureStorage(),
      fileFilter: this.createFileFilter(),
      limits: {
        fileSize: this.maxFileSize,
        files: 5, // Maximum 5 files per request
        fields: 10, // Maximum 10 non-file fields
        fieldNameSize: 100, // Maximum field name size
        fieldSize: 1024 * 1024, // Maximum field value size (1MB)
        headerPairs: 2000 // Maximum header pairs
      },
      preservePath: false, // Don't preserve file path
      abortOnLimit: true, // Abort if limits exceeded
      
      // Error handling
      onError: (error, next) => {
        console.error('💥 Multer error:', error);
        
        // Sanitize error message for security
        let sanitizedMessage = 'File upload failed';
        
        if (error.code === 'LIMIT_FILE_SIZE') {
          sanitizedMessage = 'File size exceeds limit';
        } else if (error.code === 'LIMIT_FILE_COUNT') {
          sanitizedMessage = 'Too many files';
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          sanitizedMessage = 'Unexpected file field';
        }
        
        next(new Error(sanitizedMessage));
      }
    });
  }

  // Create specific upload middleware
  createUploadMiddleware(fieldConfig) {
    const upload = this.createMulterConfig();
    
    // Different field configurations
    switch (fieldConfig) {
      case 'single-image':
        return upload.single('image');
      
      case 'single-file':
        return upload.single('file');
      
      case 'multiple-files':
        return upload.array('files', 5);
      
      case 'mixed-fields':
        return upload.fields([
          { name: 'image', maxCount: 1 },
          { name: 'files', maxCount: 5 }
        ]);
      
      default:
        return upload.any();
    }
  }

  // Get upload statistics
  async getUploadStats() {
    try {
      const imageDir = path.join(this.uploadPath, 'images');
      const fileDir = path.join(this.uploadPath, 'files');
      
      const [imageFiles, regularFiles] = await Promise.all([
        fs.readdir(imageDir).catch(() => []),
        fs.readdir(fileDir).catch(() => [])
      ]);

      return {
        totalImages: imageFiles.length,
        totalFiles: regularFiles.length,
        totalUploads: imageFiles.length + regularFiles.length,
        directories: {
          images: imageDir,
          files: fileDir,
          temp: path.join(this.uploadPath, 'temp'),
          quarantine: path.join(this.uploadPath, 'quarantine')
        }
      };
    } catch (error) {
      console.error('💥 Error getting upload stats:', error);
      return {
        totalImages: 0,
        totalFiles: 0,
        totalUploads: 0,
        error: error.message
      };
    }
  }

  // Clean up old temporary files
  async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    try {
      const tempDir = path.join(this.uploadPath, 'temp');
      const files = await fs.readdir(tempDir).catch(() => []);
      
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (Date.now() - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
          console.log(`🗑️ Cleaned up old temp file: ${file}`);
        }
      }
      
      console.log(`✅ Cleanup complete: ${cleanedCount} files removed`);
      return { cleanedCount };
    } catch (error) {
      console.error('💥 Error during temp file cleanup:', error);
      return { cleanedCount: 0, error: error.message };
    }
  }
}

// Create and export singleton instance
const secureUploadConfig = new SecureUploadConfig();

module.exports = secureUploadConfig;