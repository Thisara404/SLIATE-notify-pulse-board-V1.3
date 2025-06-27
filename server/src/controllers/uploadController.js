// Upload Controller - Secure file upload handling
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { config } = require('../config/environment');
const { 
  logApiAccess, 
  logSecurityEvent,
  logDataModification 
} = require('../middleware/logging');

class UploadController {
  constructor() {
    // Configure multer for file uploads
    this.storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const uploadDir = path.join(process.cwd(), config.upload.uploadPath);
          
          // Ensure upload directory exists
          await fs.mkdir(uploadDir, { recursive: true });
          
          cb(null, uploadDir);
        } catch (error) {
          console.error('💥 Upload directory error:', error.message);
          cb(error, null);
        }
      },
      filename: (req, file, cb) => {
        try {
          // Generate secure filename
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(8).toString('hex');
          const extension = path.extname(file.originalname);
          const baseName = path.basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);
          
          const filename = `${timestamp}_${randomString}_${baseName}${extension}`;
          cb(null, filename);
        } catch (error) {
          console.error('💥 Filename generation error:', error.message);
          cb(error, null);
        }
      }
    });

    // File filter for security
    this.fileFilter = (req, file, cb) => {
      try {
        const isImage = config.upload.allowedImageTypes.includes(file.mimetype);
        const isDocument = config.upload.allowedFileTypes.includes(file.mimetype);

        if (isImage || isDocument) {
          cb(null, true);
        } else {
          logSecurityEvent(req, 'INVALID_FILE_TYPE', {
            filename: file.originalname,
            mimetype: file.mimetype,
            severity: 'medium'
          });
          
          cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
      } catch (error) {
        console.error('💥 File filter error:', error.message);
        cb(error, false);
      }
    };

    // Configure multer instance
    this.upload = multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: {
        fileSize: config.upload.maxFileSize,
        files: 10 // Max 10 files per request
      }
    });
  }

  // Upload single image
  uploadImage = async (req, res) => {
    try {
      logApiAccess(req, 'UPLOAD_IMAGE');

      // Check authentication
      if (!req.user || !req.user.isAdmin()) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied',
          message: 'Only administrators can upload images',
          timestamp: new Date().toISOString()
        });
      }

      // Use multer middleware
      const uploadSingle = this.upload.single('image');
      
      uploadSingle(req, res, async (error) => {
        try {
          if (error) {
            console.error('💥 Image upload error:', error.message);

            let statusCode = 400;
            let message = error.message;

            if (error.code === 'LIMIT_FILE_SIZE') {
              message = `File too large. Maximum size is ${(config.upload.maxImageSize / 1024 / 1024).toFixed(1)}MB`;
            } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
              message = 'Unexpected file field';
            }

            return res.status(statusCode).json({
              success: false,
              error: 'Upload Failed',
              message,
              timestamp: new Date().toISOString()
            });
          }

          if (!req.file) {
            return res.status(400).json({
              success: false,
              error: 'No File',
              message: 'No image file was uploaded',
              timestamp: new Date().toISOString()
            });
          }

          // Validate file size for images
          if (req.file.size > config.upload.maxImageSize) {
            // Delete the uploaded file
            await fs.unlink(req.file.path);
            
            return res.status(400).json({
              success: false,
              error: 'File Too Large',
              message: `Image file too large. Maximum size is ${(config.upload.maxImageSize / 1024 / 1024).toFixed(1)}MB`,
              timestamp: new Date().toISOString()
            });
          }

          // Generate file URL
          const fileUrl = `/uploads/${req.file.filename}`;

          // Log the upload
          logDataModification(
            { user: req.user },
            'UPLOAD',
            'files',
            {
              filename: req.file.filename,
              originalName: req.file.originalname,
              size: req.file.size,
              type: 'image',
              success: true
            }
          );

          console.log(`🖼️ Image uploaded: ${req.file.filename} by ${req.user.username}`);

          res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
              file: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: fileUrl
              }
            },
            timestamp: new Date().toISOString()
          });

        } catch (processingError) {
          console.error('💥 Image processing error:', processingError.message);

          res.status(500).json({
            success: false,
            error: 'Processing Failed',
            message: 'An error occurred while processing the image',
            timestamp: new Date().toISOString()
          });
        }
      });

    } catch (error) {
      console.error('💥 Upload image error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Upload Failed',
        message: 'An error occurred during image upload',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Upload multiple files
  uploadFiles = async (req, res) => {
    try {
      logApiAccess(req, 'UPLOAD_FILES');

      // Check authentication
      if (!req.user || !req.user.isAdmin()) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied',
          message: 'Only administrators can upload files',
          timestamp: new Date().toISOString()
        });
      }

      // Use multer middleware for multiple files
      const uploadMultiple = this.upload.array('files', 10);
      
      uploadMultiple(req, res, async (error) => {
        try {
          if (error) {
            console.error('💥 Files upload error:', error.message);

            let statusCode = 400;
            let message = error.message;

            if (error.code === 'LIMIT_FILE_SIZE') {
              message = `File too large. Maximum size is ${(config.upload.maxFileSize / 1024 / 1024).toFixed(1)}MB`;
            } else if (error.code === 'LIMIT_FILE_COUNT') {
              message = 'Too many files. Maximum 10 files allowed';
            }

            return res.status(statusCode).json({
              success: false,
              error: 'Upload Failed',
              message,
              timestamp: new Date().toISOString()
            });
          }

          if (!req.files || req.files.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'No Files',
              message: 'No files were uploaded',
              timestamp: new Date().toISOString()
            });
          }

          // Process uploaded files
          const uploadedFiles = [];
          const errors = [];

          for (const file of req.files) {
            try {
              // Validate individual file size
              const maxSize = config.upload.allowedImageTypes.includes(file.mimetype) 
                ? config.upload.maxImageSize 
                : config.upload.maxFileSize;

              if (file.size > maxSize) {
                // Delete oversized file
                await fs.unlink(file.path);
                errors.push(`${file.originalname}: File too large`);
                continue;
              }

              // Generate file URL
              const fileUrl = `/uploads/${file.filename}`;

              uploadedFiles.push({
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                url: fileUrl,
                type: config.upload.allowedImageTypes.includes(file.mimetype) ? 'image' : 'document'
              });

              // Log individual file upload
              logDataModification(
                { user: req.user },
                'UPLOAD',
                'files',
                {
                  filename: file.filename,
                  originalName: file.originalname,
                  size: file.size,
                  type: config.upload.allowedImageTypes.includes(file.mimetype) ? 'image' : 'document',
                  success: true
                }
              );

            } catch (fileError) {
              console.error(`💥 Error processing file ${file.originalname}:`, fileError.message);
              errors.push(`${file.originalname}: Processing failed`);
            }
          }

          console.log(`📁 ${uploadedFiles.length} files uploaded by ${req.user.username}`);

          res.status(200).json({
            success: true,
            message: `${uploadedFiles.length} files uploaded successfully`,
            data: {
              files: uploadedFiles,
              uploadedCount: uploadedFiles.length,
              errorCount: errors.length,
              errors: errors
            },
            timestamp: new Date().toISOString()
          });

        } catch (processingError) {
          console.error('💥 Files processing error:', processingError.message);

          res.status(500).json({
            success: false,
            error: 'Processing Failed',
            message: 'An error occurred while processing the files',
            timestamp: new Date().toISOString()
          });
        }
      });

    } catch (error) {
      console.error('💥 Upload files error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Upload Failed',
        message: 'An error occurred during file upload',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Delete uploaded file
  deleteFile = async (req, res) => {
    try {
      const { filename } = req.params;

      logApiAccess(req, 'DELETE_FILE', { filename });

      // Check authentication
      if (!req.user || !req.user.isAdmin()) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied',
          message: 'Only administrators can delete files',
          timestamp: new Date().toISOString()
        });
      }

      // Validate filename
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Valid filename is required',
          timestamp: new Date().toISOString()
        });
      }

      // Security check - prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        logSecurityEvent(req, 'DIRECTORY_TRAVERSAL_ATTEMPT', {
          filename,
          severity: 'high'
        });

        return res.status(400).json({
          success: false,
          error: 'Security Error',
          message: 'Invalid filename',
          timestamp: new Date().toISOString()
        });
      }

      // Construct file path
      const filePath = path.join(process.cwd(), config.upload.uploadPath, filename);

      try {
        // Check if file exists
        await fs.access(filePath);
        
        // Delete file
        await fs.unlink(filePath);

        // Log the deletion
        logDataModification(
          { user: req.user },
          'DELETE',
          'files',
          {
            filename,
            success: true
          }
        );

        console.log(`🗑️ File deleted: ${filename} by ${req.user.username}`);

        res.status(200).json({
          success: true,
          message: 'File deleted successfully',
          data: {
            filename
          },
          timestamp: new Date().toISOString()
        });

      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          return res.status(404).json({
            success: false,
            error: 'File Not Found',
            message: 'File not found',
            timestamp: new Date().toISOString()
          });
        }

        throw fileError;
      }

    } catch (error) {
      console.error('💥 Delete file error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Deletion Failed',
        message: 'An error occurred while deleting the file',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Get uploaded files list
  getUploadedFiles = async (req, res) => {
    try {
      const { page = 1, limit = 20, type = 'all' } = req.query;

      logApiAccess(req, 'GET_UPLOADED_FILES');

      // Check authentication
      if (!req.user || !req.user.isAdmin()) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied',
          message: 'Only administrators can view uploaded files',
          timestamp: new Date().toISOString()
        });
      }

      const uploadDir = path.join(process.cwd(), config.upload.uploadPath);

      try {
        // Read upload directory
        const files = await fs.readdir(uploadDir);
        
        // Get file details
        const fileDetails = [];

        for (const filename of files) {
          try {
            const filePath = path.join(uploadDir, filename);
            const stats = await fs.stat(filePath);
            
            if (stats.isFile()) {
              const ext = path.extname(filename).toLowerCase();
              const mimetype = this.getMimetypeFromExtension(ext);
              const fileType = config.upload.allowedImageTypes.includes(mimetype) ? 'image' : 'document';

              // Filter by type if specified
              if (type !== 'all' && type !== fileType) {
                continue;
              }

              fileDetails.push({
                filename,
                size: stats.size,
                mimetype,
                type: fileType,
                url: `/uploads/${filename}`,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
              });
            }
          } catch (fileError) {
            console.warn(`⚠️ Error reading file ${filename}:`, fileError.message);
          }
        }

        // Sort by creation date (newest first)
        fileDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Paginate results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedFiles = fileDetails.slice(startIndex, endIndex);

        res.status(200).json({
          success: true,
          message: 'Uploaded files retrieved successfully',
          data: {
            files: paginatedFiles,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: fileDetails.length,
              totalPages: Math.ceil(fileDetails.length / limit)
            },
            filter: type
          },
          timestamp: new Date().toISOString()
        });

      } catch (dirError) {
        if (dirError.code === 'ENOENT') {
          return res.status(200).json({
            success: true,
            message: 'Upload directory is empty',
            data: {
              files: [],
              pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 }
            },
            timestamp: new Date().toISOString()
          });
        }

        throw dirError;
      }

    } catch (error) {
      console.error('💥 Get uploaded files error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Retrieval Failed',
        message: 'An error occurred while retrieving uploaded files',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Helper method: Get mimetype from file extension
  getMimetypeFromExtension(ext) {
    const mimetypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.zip': 'application/zip'
    };

    return mimetypes[ext] || 'application/octet-stream';
  }
}

// Create and export controller instance
const uploadController = new UploadController();

module.exports = {
  uploadImage: uploadController.uploadImage,
  uploadFiles: uploadController.uploadFiles,
  deleteFile: uploadController.deleteFile,
  getUploadedFiles: uploadController.getUploadedFiles
};