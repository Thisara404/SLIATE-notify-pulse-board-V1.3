// File Service - Business logic for file handling and management
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { validateFile } = require('../utils/fileValidator');
const { sanitize } = require('../utils/inputSanitizer');
const { config } = require('../config/environment');
const { 
  logFileOperation, 
  logSecurityEvent,
  logUserAction 
} = require('../utils/logger');

class FileService {
  constructor() {
    // File service configuration
    this.config = {
      uploadPath: config.upload.uploadPath || 'uploads',
      maxFileSize: config.upload.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxImageSize: config.upload.maxImageSize || 5 * 1024 * 1024, // 5MB
      allowedImageTypes: config.upload.allowedImageTypes || [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'
      ],
      allowedFileTypes: config.upload.allowedFileTypes || [
        'application/pdf', 'application/msword', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      thumbnailSizes: [
        { name: 'small', width: 150, height: 150 },
        { name: 'medium', width: 300, height: 300 },
        { name: 'large', width: 800, height: 600 }
      ],
      enableImageProcessing: true,
      enableVirusScanning: false, // Would integrate with antivirus service
      retentionPeriod: 365, // days
      cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
    };

    // File categories
    this.categories = {
      image: {
        types: this.config.allowedImageTypes,
        maxSize: this.config.maxImageSize,
        validation: 'images'
      },
      document: {
        types: this.config.allowedFileTypes,
        maxSize: this.config.maxFileSize,
        validation: 'documents'
      }
    };

    // File operation types
    this.operations = {
      UPLOAD: 'upload',
      DOWNLOAD: 'download',
      DELETE: 'delete',
      VIEW: 'view',
      PROCESS: 'process'
    };

    // Start cleanup scheduler
    this.startCleanupScheduler();
  }

  /**
   * Process uploaded file
   * @param {Object} file - Uploaded file object
   * @param {Object} user - User uploading the file
   * @param {Object} context - Request context
   * @returns {Object} - Processing result
   */
  async processUploadedFile(file, user, context = {}) {
    try {
      console.log(`📁 Processing uploaded file: ${file.originalname} by ${user.username}`);

      // Step 1: Validate user permissions
      const permissionCheck = await this.checkFilePermissions(user, this.operations.UPLOAD);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Determine file category
      const category = this.determineFileCategory(file.mimetype);
      if (!category) {
        await logSecurityEvent(context, 'UNSUPPORTED_FILE_TYPE', {
          filename: file.originalname,
          mimetype: file.mimetype,
          uploadedBy: user.username,
          severity: 'medium'
        });

        return {
          success: false,
          reason: 'unsupported_file_type',
          message: 'File type not supported'
        };
      }

      // Step 3: Validate file security
      const validation = await validateFile(file, category.validation, context);
      if (!validation.safe) {
        await logSecurityEvent(context, 'UNSAFE_FILE_UPLOAD', {
          filename: file.originalname,
          threats: validation.threats,
          riskScore: validation.riskScore,
          uploadedBy: user.username,
          severity: 'high'
        });

        return {
          success: false,
          reason: 'security_validation_failed',
          message: 'File failed security validation',
          threats: validation.threats,
          riskScore: validation.riskScore
        };
      }

      // Step 4: Sanitize filename
      const sanitizedFilename = await this.sanitizeFilename(file.originalname);

      // Step 5: Generate secure filename
      const secureFilename = await this.generateSecureFilename(sanitizedFilename);

      // Step 6: Move file to secure location
      const finalPath = path.join(this.config.uploadPath, secureFilename);
      await fs.rename(file.path, finalPath);

      // Step 7: Generate file metadata
      const metadata = await this.generateFileMetadata(file, secureFilename, user);

      // Step 8: Process file if needed (thumbnails, etc.)
      const processingResult = await this.processFileContent(finalPath, file.mimetype, metadata);

      // Step 9: Log file upload
      await logFileOperation(context, this.operations.UPLOAD, file.originalname, {
        secureFilename: secureFilename,
        fileSize: file.size,
        mimetype: file.mimetype,
        category: category.validation,
        processingResult: processingResult
      });

      console.log(`✅ File processed successfully: ${secureFilename}`);

      return {
        success: true,
        file: {
          filename: secureFilename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          category: category.validation,
          url: `/uploads/${secureFilename}`,
          metadata: metadata,
          processing: processingResult
        },
        message: 'File uploaded and processed successfully'
      };

    } catch (error) {
      console.error('💥 File processing error:', error.message);

      // Clean up file on error
      try {
        if (file.path) {
          await fs.unlink(file.path);
        }
      } catch (cleanupError) {
        console.error('💥 File cleanup error:', cleanupError.message);
      }

      return {
        success: false,
        reason: 'processing_error',
        message: 'Failed to process uploaded file'
      };
    }
  }

  /**
   * Get file information
   * @param {string} filename - Filename
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - File information
   */
  async getFileInfo(filename, user, context = {}) {
    try {
      console.log(`📄 Getting file info: ${filename} for ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkFilePermissions(user, this.operations.VIEW);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Sanitize filename
      const sanitizedFilename = await this.sanitizeFilename(filename);

      // Step 3: Check if file exists
      const filePath = path.join(this.config.uploadPath, sanitizedFilename);
      
      try {
        const stats = await fs.stat(filePath);
        
        // Step 4: Get file metadata
        const metadata = await this.getFileMetadata(sanitizedFilename, stats);

        // Step 5: Log file view
        await logFileOperation(context, this.operations.VIEW, sanitizedFilename, {
          fileSize: stats.size,
          viewedBy: user.username
        });

        return {
          success: true,
          file: {
            filename: sanitizedFilename,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            url: `/uploads/${sanitizedFilename}`,
            metadata: metadata
          }
        };

      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          return {
            success: false,
            reason: 'file_not_found',
            message: 'File not found'
          };
        }
        throw fileError;
      }

    } catch (error) {
      console.error('💥 Get file info error:', error.message);
      return {
        success: false,
        reason: 'info_error',
        message: 'Failed to get file information'
      };
    }
  }

  /**
   * Delete file
   * @param {string} filename - Filename to delete
   * @param {Object} user - User deleting the file
   * @param {Object} context - Request context
   * @returns {Object} - Deletion result
   */
  async deleteFile(filename, user, context = {}) {
    try {
      console.log(`🗑️ Deleting file: ${filename} by ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkFilePermissions(user, this.operations.DELETE);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Sanitize filename
      const sanitizedFilename = await this.sanitizeFilename(filename);

      // Step 3: Security check - prevent directory traversal
      if (this.containsDirectoryTraversal(sanitizedFilename)) {
        await logSecurityEvent(context, 'DIRECTORY_TRAVERSAL_ATTEMPT', {
          filename: sanitizedFilename,
          attemptedBy: user.username,
          severity: 'high'
        });

        return {
          success: false,
          reason: 'security_violation',
          message: 'Invalid filename'
        };
      }

      // Step 4: Check if file exists and get info
      const filePath = path.join(this.config.uploadPath, sanitizedFilename);
      
      try {
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;

        // Step 5: Delete file
        await fs.unlink(filePath);

        // Step 6: Delete associated thumbnails/processed files
        await this.deleteAssociatedFiles(sanitizedFilename);

        // Step 7: Log file deletion
        await logFileOperation(context, this.operations.DELETE, sanitizedFilename, {
          fileSize: fileSize,
          deletedBy: user.username
        });

        console.log(`✅ File deleted successfully: ${sanitizedFilename}`);

        return {
          success: true,
          deletedFile: {
            filename: sanitizedFilename,
            size: fileSize
          },
          message: 'File deleted successfully'
        };

      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          return {
            success: false,
            reason: 'file_not_found',
            message: 'File not found'
          };
        }
        throw fileError;
      }

    } catch (error) {
      console.error('💥 File deletion error:', error.message);
      return {
        success: false,
        reason: 'deletion_error',
        message: 'Failed to delete file'
      };
    }
  }

  /**
   * List uploaded files with pagination
   * @param {Object} options - List options
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - File list
   */
  async listFiles(options = {}, user, context = {}) {
    try {
      console.log(`📂 Listing files for ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkFilePermissions(user, this.operations.VIEW);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Parse options
      const {
        page = 1,
        limit = 20,
        type = 'all',
        sortBy = 'created',
        sortOrder = 'DESC'
      } = options;

      // Step 3: Read upload directory
      const uploadDir = path.join(process.cwd(), this.config.uploadPath);
      
      try {
        const files = await fs.readdir(uploadDir);
        
        // Step 4: Get file details
        const fileDetails = [];

        for (const filename of files) {
          try {
            const filePath = path.join(uploadDir, filename);
            const stats = await fs.stat(filePath);
            
            if (stats.isFile()) {
              const fileInfo = await this.getFileBasicInfo(filename, stats);
              
              // Filter by type if specified
              if (type !== 'all' && fileInfo.category !== type) {
                continue;
              }

              fileDetails.push(fileInfo);
            }
          } catch (fileError) {
            console.warn(`⚠️ Error reading file ${filename}:`, fileError.message);
          }
        }

        // Step 5: Sort files
        this.sortFiles(fileDetails, sortBy, sortOrder);

        // Step 6: Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedFiles = fileDetails.slice(startIndex, endIndex);

        // Step 7: Log file listing
        await logFileOperation(context, 'LIST', 'multiple_files', {
          fileCount: paginatedFiles.length,
          totalFiles: fileDetails.length,
          filterType: type,
          listedBy: user.username
        });

        return {
          success: true,
          files: paginatedFiles,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: fileDetails.length,
            totalPages: Math.ceil(fileDetails.length / limit)
          },
          filters: {
            type: type,
            sortBy: sortBy,
            sortOrder: sortOrder
          }
        };

      } catch (dirError) {
        if (dirError.code === 'ENOENT') {
          return {
            success: true,
            files: [],
            pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 },
            message: 'Upload directory is empty'
          };
        }
        throw dirError;
      }

    } catch (error) {
      console.error('💥 File listing error:', error.message);
      return {
        success: false,
        reason: 'listing_error',
        message: 'Failed to list files'
      };
    }
  }

  /**
   * Get file download stream
   * @param {string} filename - Filename
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - Download result
   */
  async getFileDownload(filename, user, context = {}) {
    try {
      console.log(`⬇️ Preparing download: ${filename} for ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkFilePermissions(user, this.operations.DOWNLOAD);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Sanitize filename
      const sanitizedFilename = await this.sanitizeFilename(filename);

      // Step 3: Security check
      if (this.containsDirectoryTraversal(sanitizedFilename)) {
        await logSecurityEvent(context, 'DIRECTORY_TRAVERSAL_ATTEMPT', {
          filename: sanitizedFilename,
          attemptedBy: user.username,
          operation: 'download',
          severity: 'high'
        });

        return {
          success: false,
          reason: 'security_violation',
          message: 'Invalid filename'
        };
      }

      // Step 4: Check if file exists
      const filePath = path.join(this.config.uploadPath, sanitizedFilename);
      
      try {
        const stats = await fs.stat(filePath);

        // Step 5: Log download
        await logFileOperation(context, this.operations.DOWNLOAD, sanitizedFilename, {
          fileSize: stats.size,
          downloadedBy: user.username
        });

        return {
          success: true,
          filePath: filePath,
          filename: sanitizedFilename,
          size: stats.size,
          mimeType: this.getMimeTypeFromFilename(sanitizedFilename)
        };

      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          return {
            success: false,
            reason: 'file_not_found',
            message: 'File not found'
          };
        }
        throw fileError;
      }

    } catch (error) {
      console.error('💥 File download preparation error:', error.message);
      return {
        success: false,
        reason: 'download_error',
        message: 'Failed to prepare file download'
      };
    }
  }

  /**
   * Clean up old and orphaned files
   * @param {Object} user - User initiating cleanup
   * @param {Object} context - Request context
   * @returns {Object} - Cleanup result
   */
  async cleanupFiles(user, context = {}) {
    try {
      console.log(`🧹 Starting file cleanup by ${user.username}`);

      // Step 1: Validate permissions
      if (!user.isSuperAdmin()) {
        return {
          success: false,
          reason: 'insufficient_permissions',
          message: 'Only super administrators can perform file cleanup'
        };
      }

      // Step 2: Find old files
      const cutoffDate = new Date(Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000));
      const uploadDir = path.join(process.cwd(), this.config.uploadPath);
      const files = await fs.readdir(uploadDir);

      const oldFiles = [];
      const errors = [];

      // Step 3: Check each file
      for (const filename of files) {
        try {
          const filePath = path.join(uploadDir, filename);
          const stats = await fs.stat(filePath);

                    if (stats.mtime < cutoffDate) {
            oldFiles.push({
              filename: filename,
              path: filePath,
              size: stats.size,
              lastModified: stats.mtime
            });
          }
        } catch (fileError) {
          errors.push({
            filename: filename,
            error: fileError.message
          });
        }
      }

      // Step 4: Delete old files
      let deletedCount = 0;
      let totalSizeFreed = 0;

      for (const file of oldFiles) {
        try {
          await fs.unlink(file.path);
          await this.deleteAssociatedFiles(file.filename);
          
          deletedCount++;
          totalSizeFreed += file.size;
          
          console.log(`🗑️ Deleted old file: ${file.filename}`);
        } catch (deleteError) {
          errors.push({
            filename: file.filename,
            error: deleteError.message
          });
        }
      }

      // Step 5: Log cleanup operation
      await logUserAction(context, 'FILE_CLEANUP_PERFORMED', {
        oldFilesFound: oldFiles.length,
        filesDeleted: deletedCount,
        totalSizeFreed: totalSizeFreed,
        errors: errors.length,
        cutoffDate: cutoffDate.toISOString(),
        performedBy: user.username
      });

      console.log(`✅ File cleanup completed: ${deletedCount} files deleted, ${this.formatFileSize(totalSizeFreed)} freed`);

      return {
        success: true,
        cleanup: {
          oldFilesFound: oldFiles.length,
          filesDeleted: deletedCount,
          totalSizeFreed: totalSizeFreed,
          errors: errors,
          cutoffDate: cutoffDate.toISOString()
        },
        message: `Cleanup completed: ${deletedCount} files deleted`
      };

    } catch (error) {
      console.error('💥 File cleanup error:', error.message);
      return {
        success: false,
        reason: 'cleanup_error',
        message: 'Failed to perform file cleanup'
      };
    }
  }

  /**
   * Get file storage statistics
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - Storage statistics
   */
  async getStorageStatistics(user, context = {}) {
    try {
      console.log(`📊 Getting storage statistics for ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkFilePermissions(user, this.operations.VIEW);
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Scan upload directory
      const uploadDir = path.join(process.cwd(), this.config.uploadPath);
      const files = await fs.readdir(uploadDir);

      const stats = {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        sizeByType: {},
        oldestFile: null,
        newestFile: null,
        averageFileSize: 0
      };

      // Step 3: Analyze each file
      for (const filename of files) {
        try {
          const filePath = path.join(uploadDir, filename);
          const fileStat = await fs.stat(filePath);

          if (fileStat.isFile()) {
            stats.totalFiles++;
            stats.totalSize += fileStat.size;

            // File type analysis
            const extension = path.extname(filename).toLowerCase();
            const mimeType = this.getMimeTypeFromFilename(filename);
            const category = this.determineFileCategory(mimeType);

            const typeKey = category ? category.validation : 'unknown';
            
            stats.fileTypes[typeKey] = (stats.fileTypes[typeKey] || 0) + 1;
            stats.sizeByType[typeKey] = (stats.sizeByType[typeKey] || 0) + fileStat.size;

            // Track oldest and newest files
            if (!stats.oldestFile || fileStat.birthtime < stats.oldestFile.date) {
              stats.oldestFile = {
                filename: filename,
                date: fileStat.birthtime,
                size: fileStat.size
              };
            }

            if (!stats.newestFile || fileStat.birthtime > stats.newestFile.date) {
              stats.newestFile = {
                filename: filename,
                date: fileStat.birthtime,
                size: fileStat.size
              };
            }
          }
        } catch (fileError) {
          console.warn(`⚠️ Error analyzing file ${filename}:`, fileError.message);
        }
      }

      // Step 4: Calculate derived statistics
      stats.averageFileSize = stats.totalFiles > 0 ? Math.round(stats.totalSize / stats.totalFiles) : 0;

      // Step 5: Get disk usage information
      const diskUsage = await this.getDiskUsage();

      // Step 6: Log statistics access
      await logUserAction(context, 'STORAGE_STATISTICS_VIEWED', {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
        viewedBy: user.username
      });

      return {
        success: true,
        statistics: {
          ...stats,
          formattedTotalSize: this.formatFileSize(stats.totalSize),
          formattedAverageSize: this.formatFileSize(stats.averageFileSize),
          diskUsage: diskUsage
        }
      };

    } catch (error) {
      console.error('💥 Storage statistics error:', error.message);
      return {
        success: false,
        reason: 'statistics_error',
        message: 'Failed to get storage statistics'
      };
    }
  }

  /**
   * Validate file permissions for user
   * @param {Object} user - User object
   * @param {string} operation - Operation type
   * @returns {Object} - Permission check result
   */
  async checkFilePermissions(user, operation) {
    try {
      // Super admin can do everything
      if (user.isSuperAdmin()) {
        return { allowed: true };
      }

      // Regular admin can upload, view, and download
      if (user.isAdmin()) {
        const allowedOperations = [
          this.operations.UPLOAD,
          this.operations.VIEW,
          this.operations.DOWNLOAD,
          this.operations.DELETE
        ];

        if (allowedOperations.includes(operation)) {
          return { allowed: true };
        }

        return {
          allowed: false,
          success: false,
          reason: 'insufficient_permissions',
          message: 'This operation requires super admin privileges'
        };
      }

      // Non-admin users have no file permissions
      return {
        allowed: false,
        success: false,
        reason: 'access_denied',
        message: 'File operations require admin privileges'
      };

    } catch (error) {
      console.error('💥 File permission check error:', error.message);
      return {
        allowed: false,
        success: false,
        reason: 'permission_check_error',
        message: 'Failed to check file permissions'
      };
    }
  }

  /**
   * Determine file category based on MIME type
   * @param {string} mimeType - MIME type
   * @returns {Object|null} - File category or null
   */
  determineFileCategory(mimeType) {
    try {
      for (const [categoryName, category] of Object.entries(this.categories)) {
        if (category.types.includes(mimeType)) {
          return category;
        }
      }
      return null;
    } catch (error) {
      console.error('💥 Category determination error:', error.message);
      return null;
    }
  }

  /**
   * Sanitize filename for security
   * @param {string} filename - Original filename
   * @returns {string} - Sanitized filename
   */
  async sanitizeFilename(filename) {
    try {
      if (!filename || typeof filename !== 'string') {
        return 'unknown_file';
      }

      // Sanitize using input sanitizer
      const result = sanitize(filename, 'filename');
      if (!result.safe) {
        return 'sanitized_file';
      }

      let sanitized = result.sanitized;

      // Remove dangerous characters
      sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f\x7f-\x9f]/g, '');

      // Replace spaces with underscores
      sanitized = sanitized.replace(/\s+/g, '_');

      // Remove multiple underscores
      sanitized = sanitized.replace(/_+/g, '_');

      // Remove leading/trailing underscores and dots
      sanitized = sanitized.replace(/^[._]+|[._]+$/g, '');

      // Ensure filename is not empty
      if (sanitized.length === 0) {
        sanitized = 'file';
      }

      // Limit filename length
      if (sanitized.length > 200) {
        const extension = path.extname(sanitized);
        const basename = path.basename(sanitized, extension);
        sanitized = basename.substring(0, 200 - extension.length) + extension;
      }

      return sanitized;

    } catch (error) {
      console.error('💥 Filename sanitization error:', error.message);
      return 'error_file';
    }
  }

  /**
   * Generate secure filename
   * @param {string} originalFilename - Original filename
   * @returns {string} - Secure filename
   */
  async generateSecureFilename(originalFilename) {
    try {
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const extension = path.extname(originalFilename);
      const basename = path.basename(originalFilename, extension);

      // Create secure filename with timestamp and random string
      const secureFilename = `${timestamp}_${randomString}_${basename}${extension}`;

      return secureFilename;

    } catch (error) {
      console.error('💥 Secure filename generation error:', error.message);
      const timestamp = Date.now();
      return `${timestamp}_secure_file`;
    }
  }

  /**
   * Generate file metadata
   * @param {Object} file - File object
   * @param {string} secureFilename - Secure filename
   * @param {Object} user - Uploading user
   * @returns {Object} - File metadata
   */
  async generateFileMetadata(file, secureFilename, user) {
    try {
      const metadata = {
        originalName: file.originalname,
        secureFilename: secureFilename,
        size: file.size,
        mimetype: file.mimetype,
        uploadedBy: user.username,
        uploadedById: user.id,
        uploadedAt: new Date().toISOString(),
        checksum: await this.calculateFileChecksum(file.path),
        category: this.determineFileCategory(file.mimetype)?.validation || 'unknown'
      };

      return metadata;

    } catch (error) {
      console.error('💥 Metadata generation error:', error.message);
      return {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
        error: 'Failed to generate complete metadata'
      };
    }
  }

  /**
   * Process file content (generate thumbnails, etc.)
   * @param {string} filePath - File path
   * @param {string} mimeType - MIME type
   * @param {Object} metadata - File metadata
   * @returns {Object} - Processing result
   */
  async processFileContent(filePath, mimeType, metadata) {
    try {
      const processingResult = {
        thumbnails: [],
        processed: false,
        error: null
      };

      // Only process images if image processing is enabled
      if (this.config.enableImageProcessing && this.config.allowedImageTypes.includes(mimeType)) {
        try {
          // In a real implementation, you'd use libraries like Sharp or ImageMagick
          // For now, we'll simulate thumbnail generation
          console.log(`🖼️ Processing image: ${path.basename(filePath)}`);

          for (const size of this.config.thumbnailSizes) {
            const thumbnailPath = this.generateThumbnailPath(filePath, size.name);
            
            // Simulate thumbnail generation
            processingResult.thumbnails.push({
              size: size.name,
              width: size.width,
              height: size.height,
              path: thumbnailPath,
              url: `/uploads/thumbnails/${path.basename(thumbnailPath)}`
            });
          }

          processingResult.processed = true;
          console.log(`✅ Image processing completed: ${processingResult.thumbnails.length} thumbnails generated`);

        } catch (processingError) {
          console.error('💥 Image processing error:', processingError.message);
          processingResult.error = processingError.message;
        }
      }

      return processingResult;

    } catch (error) {
      console.error('💥 File content processing error:', error.message);
      return {
        thumbnails: [],
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate file checksum
   * @param {string} filePath - File path
   * @returns {string} - File checksum
   */
  async calculateFileChecksum(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      return hash.digest('hex');

    } catch (error) {
      console.error('💥 Checksum calculation error:', error.message);
      return 'checksum_error';
    }
  }

  /**
   * Get file metadata from filesystem
   * @param {string} filename - Filename
   * @param {Object} stats - File stats
   * @returns {Object} - File metadata
   */
  async getFileMetadata(filename, stats) {
    try {
      const mimeType = this.getMimeTypeFromFilename(filename);
      const category = this.determineFileCategory(mimeType);

      return {
        filename: filename,
        size: stats.size,
        mimetype: mimeType,
        category: category?.validation || 'unknown',
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        formattedSize: this.formatFileSize(stats.size)
      };

    } catch (error) {
      console.error('💥 Metadata retrieval error:', error.message);
      return {
        filename: filename,
        error: 'Failed to retrieve metadata'
      };
    }
  }

  /**
   * Get basic file information
   * @param {string} filename - Filename
   * @param {Object} stats - File stats
   * @returns {Object} - Basic file info
   */
  async getFileBasicInfo(filename, stats) {
    try {
      const mimeType = this.getMimeTypeFromFilename(filename);
      const category = this.determineFileCategory(mimeType);

      return {
        filename: filename,
        size: stats.size,
        formattedSize: this.formatFileSize(stats.size),
        mimetype: mimeType,
        category: category?.validation || 'unknown',
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        url: `/uploads/${filename}`
      };

    } catch (error) {
      console.error('💥 Basic file info error:', error.message);
      return {
        filename: filename,
        size: 0,
        category: 'unknown',
        error: 'Failed to get file info'
      };
    }
  }

  /**
   * Sort files array
   * @param {Array} files - Files array
   * @param {string} sortBy - Sort field
   * @param {string} sortOrder - Sort order
   */
  sortFiles(files, sortBy, sortOrder) {
    try {
      files.sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
          case 'name':
            aValue = a.filename.toLowerCase();
            bValue = b.filename.toLowerCase();
            break;
          case 'size':
            aValue = a.size;
            bValue = b.size;
            break;
          case 'created':
            aValue = new Date(a.createdAt);
            bValue = new Date(b.createdAt);
            break;
          case 'modified':
            aValue = new Date(a.modifiedAt);
            bValue = new Date(b.modifiedAt);
            break;
          default:
            aValue = new Date(a.createdAt);
            bValue = new Date(b.createdAt);
        }

        if (sortOrder.toLowerCase() === 'desc') {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });

    } catch (error) {
      console.error('💥 File sorting error:', error.message);
    }
  }

  /**
   * Delete associated files (thumbnails, etc.)
   * @param {string} filename - Main filename
   */
  async deleteAssociatedFiles(filename) {
    try {
      // Delete thumbnails if they exist
      for (const size of this.config.thumbnailSizes) {
        const thumbnailPath = this.generateThumbnailPath(
          path.join(this.config.uploadPath, filename), 
          size.name
        );

        try {
          await fs.unlink(thumbnailPath);
          console.log(`🗑️ Deleted thumbnail: ${path.basename(thumbnailPath)}`);
        } catch (thumbnailError) {
          // Thumbnail might not exist, which is fine
        }
      }

    } catch (error) {
      console.error('💥 Associated files deletion error:', error.message);
    }
  }

  /**
   * Check for directory traversal in filename
   * @param {string} filename - Filename to check
   * @returns {boolean} - Whether filename contains traversal
   */
  containsDirectoryTraversal(filename) {
    try {
      const traversalPatterns = [
        /\.\./,
        /\.\//,
        /\.\\/,
        /\//,
        /\\/,
        /\0/
      ];

      return traversalPatterns.some(pattern => pattern.test(filename));

    } catch (error) {
      console.error('💥 Directory traversal check error:', error.message);
      return true; // Err on the side of caution
    }
  }

  /**
   * Get MIME type from filename
   * @param {string} filename - Filename
   * @returns {string} - MIME type
   */
  getMimeTypeFromFilename(filename) {
    try {
      const extension = path.extname(filename).toLowerCase();
      
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain',
        '.zip': 'application/zip'
      };

      return mimeTypes[extension] || 'application/octet-stream';

    } catch (error) {
      console.error('💥 MIME type detection error:', error.message);
      return 'application/octet-stream';
    }
  }

  /**
   * Generate thumbnail path
   * @param {string} originalPath - Original file path
   * @param {string} sizeName - Thumbnail size name
   * @returns {string} - Thumbnail path
   */
  generateThumbnailPath(originalPath, sizeName) {
    try {
      const dir = path.dirname(originalPath);
      const basename = path.basename(originalPath, path.extname(originalPath));
      const extension = path.extname(originalPath);

      const thumbnailDir = path.join(dir, 'thumbnails');
      const thumbnailFilename = `${basename}_${sizeName}${extension}`;

      return path.join(thumbnailDir, thumbnailFilename);

    } catch (error) {
      console.error('💥 Thumbnail path generation error:', error.message);
      return originalPath + '_thumb';
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted file size
   */
  formatFileSize(bytes) {
    try {
      if (bytes === 0) return '0 Bytes';

      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];

    } catch (error) {
      console.error('💥 File size formatting error:', error.message);
      return bytes + ' Bytes';
    }
  }

  /**
   * Get disk usage information
   * @returns {Object} - Disk usage info
   */
  async getDiskUsage() {
    try {
      // In a real implementation, you'd use a library like 'node-disk-usage'
      // For now, return mock data
      return {
        total: 1024 * 1024 * 1024 * 100, // 100GB
        used: 1024 * 1024 * 1024 * 25,   // 25GB
        available: 1024 * 1024 * 1024 * 75, // 75GB
        usagePercentage: 25
      };

    } catch (error) {
      console.error('💥 Disk usage error:', error.message);
      return {
        total: 0,
        used: 0,
        available: 0,
        usagePercentage: 0
      };
    }
  }

  /**
   * Start cleanup scheduler
   */
  startCleanupScheduler() {
    try {
      // Run cleanup every 24 hours
      setInterval(async () => {
        try {
          console.log('🧹 Starting scheduled file cleanup...');
          
          // Create a system user context for scheduled cleanup
          const systemUser = {
            id: 0,
            username: 'system',
            isSuperAdmin: () => true
          };

          await this.cleanupFiles(systemUser, { 
            automated: true,
            ipAddress: 'system',
            userAgent: 'file-cleanup-scheduler'
          });

        } catch (cleanupError) {
          console.error('💥 Scheduled cleanup error:', cleanupError.message);
        }
      }, this.config.cleanupInterval);

      console.log('📅 File cleanup scheduler started');

    } catch (error) {
      console.error('💥 Cleanup scheduler error:', error.message);
    }
  }

  /**
   * Get file service statistics
   * @returns {Object} - Service statistics
   */
  getServiceStatistics() {
    try {
      return {
        config: {
          uploadPath: this.config.uploadPath,
          maxFileSize: this.formatFileSize(this.config.maxFileSize),
          maxImageSize: this.formatFileSize(this.config.maxImageSize),
          retentionPeriod: this.config.retentionPeriod + ' days',
          allowedImageTypes: this.config.allowedImageTypes.length,
          allowedFileTypes: this.config.allowedFileTypes.length
        },
        features: {
          imageProcessing: this.config.enableImageProcessing,
          virusScanning: this.config.enableVirusScanning,
          thumbnailGeneration: this.config.thumbnailSizes.length > 0,
          automaticCleanup: true
        },
        operations: {
          supportedOperations: Object.values(this.operations),
          categories: Object.keys(this.categories)
        }
      };

    } catch (error) {
      console.error('💥 Service statistics error:', error.message);
      return { error: 'Failed to get service statistics' };
    }
  }
}

// Create singleton instance
const fileService = new FileService();

module.exports = fileService;