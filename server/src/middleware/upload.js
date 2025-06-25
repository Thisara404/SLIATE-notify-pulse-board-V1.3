// Secure file upload middleware with advanced protection
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const crypto = require('crypto');
const secureUploadConfig = require('../config/upload');
const { securityValidators } = require('../config/security');

class UploadMiddleware {
    constructor() {
        this.uploadConfig = secureUploadConfig;
        this.tempDir = path.join(secureUploadConfig.uploadPath, 'temp');
        this.quarantineDir = path.join(secureUploadConfig.uploadPath, 'quarantine');
        this.virusScanEnabled = false; // Would integrate with antivirus in production
    }

    // Create comprehensive upload middleware
    createUploadMiddleware(options = {}) {
        const {
            fieldName = 'file',
            maxFiles = 1,
            fileType = 'any', // 'image', 'document', 'any'
            required = true,
            processImages = true
        } = options;

        return async (req, res, next) => {
            try {
                console.log(`📁 Starting file upload process for field: ${fieldName}`);

                // Create multer instance with security config
                const upload = this.uploadConfig.createMulterConfig();

                // Determine upload type
                let uploadHandler;
                if (maxFiles === 1) {
                    uploadHandler = upload.single(fieldName);
                } else {
                    uploadHandler = upload.array(fieldName, maxFiles);
                }

                // Execute upload
                uploadHandler(req, res, async (uploadError) => {
                    if (uploadError) {
                        return this.handleUploadError(uploadError, res);
                    }

                    try {
                        // Validate uploaded files
                        const validationResult = await this.validateUploadedFiles(req, fileType, required);

                        if (!validationResult.isValid) {
                            // Clean up uploaded files
                            await this.cleanupUploadedFiles(req);

                            return res.status(400).json({
                                success: false,
                                error: 'File Validation Failed',
                                message: validationResult.errors.join(', '),
                                timestamp: new Date().toISOString()
                            });
                        }

                        // Process images if enabled
                        if (processImages) {
                            await this.processImages(req);
                        }

                        // Scan for malware (if enabled)
                        if (this.virusScanEnabled) {
                            const scanResult = await this.scanForMalware(req);
                            if (!scanResult.clean) {
                                await this.quarantineFiles(req);
                                return res.status(400).json({
                                    success: false,
                                    error: 'Security Scan Failed',
                                    message: 'Uploaded file failed security scan',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }

                        // Generate file metadata
                        await this.generateFileMetadata(req);

                        console.log(`✅ File upload completed successfully for ${req.user?.username}`);
                        next();

                    } catch (processingError) {
                        console.error('💥 File processing error:', processingError.message);
                        await this.cleanupUploadedFiles(req);

                        return res.status(500).json({
                            success: false,
                            error: 'File Processing Failed',
                            message: 'An error occurred while processing the uploaded file',
                            timestamp: new Date().toISOString()
                        });
                    }
                });

            } catch (error) {
                console.error('💥 Upload middleware error:', error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Upload Failed',
                    message: 'File upload system error',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    // Validate uploaded files
    async validateUploadedFiles(req, fileType, required) {
        const files = this.getUploadedFiles(req);
        const errors = [];

        // Check if files are required but missing
        if (required && (!files || files.length === 0)) {
            return {
                isValid: false,
                errors: ['At least one file is required']
            };
        }

        // If no files and not required, skip validation
        if (!files || files.length === 0) {
            return { isValid: true, errors: [] };
        }

        // Validate each file
        for (const file of files) {
            try {
                // Advanced file validation
                const fileValidation = await this.validateSingleFile(file, fileType);

                if (!fileValidation.isValid) {
                    errors.push(`File "${file.originalname}": ${fileValidation.errors.join(', ')}`);
                }

            } catch (error) {
                console.error(`💥 File validation error for ${file.originalname}:`, error.message);
                errors.push(`File "${file.originalname}": Validation failed`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validate single file
    async validateSingleFile(file, expectedType) {
        const errors = [];

        try {
            // Basic file checks
            if (!file.path || !file.filename) {
                errors.push('File was not saved properly');
                return { isValid: false, errors };
            }

            // Check file exists on disk
            try {
                await fs.access(file.path);
            } catch (error) {
                errors.push('File is not accessible');
                return { isValid: false, errors };
            }

            // Get file stats
            const stats = await fs.stat(file.path);

            // Verify file size matches
            if (Math.abs(stats.size - file.size) > 1024) { // Allow 1KB difference
                errors.push('File size mismatch detected');
            }

            // Check file type constraints
            if (expectedType !== 'any') {
                const typeValidation = this.validateFileType(file, expectedType);
                if (!typeValidation.isValid) {
                    errors.push(...typeValidation.errors);
                }
            }

            // Advanced content validation for images
            if (this.isImageFile(file)) {
                const imageValidation = await this.validateImageContent(file);
                if (!imageValidation.isValid) {
                    errors.push(...imageValidation.errors);
                }
            }

            // Check for executable signatures
            const executableCheck = await this.checkForExecutableSignatures(file);
            if (executableCheck.isExecutable) {
                errors.push('File contains executable signatures');
            }

            // Validate filename security
            const filenameValidation = this.validateFilename(file.originalname);
            if (!filenameValidation.isValid) {
                errors.push(...filenameValidation.errors);
            }

        } catch (error) {
            console.error('💥 Single file validation error:', error.message);
            errors.push('File validation failed');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validate file type
    validateFileType(file, expectedType) {
        const errors = [];

        switch (expectedType) {
            case 'image':
                if (!securityValidators.isAllowedFileType(file.mimetype, true)) {
                    errors.push('File type not allowed for images');
                }
                break;

            case 'document':
                if (securityValidators.isAllowedFileType(file.mimetype, true)) {
                    errors.push('Image files not allowed in document uploads');
                } else if (!securityValidators.isAllowedFileType(file.mimetype, false)) {
                    errors.push('File type not allowed for documents');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validate image content
    async validateImageContent(file) {
        const errors = [];

        try {
            // Use Sharp to validate image
            const metadata = await sharp(file.path).metadata();

            // Check dimensions
            if (metadata.width > 10000 || metadata.height > 10000) {
                errors.push('Image dimensions too large (max 10000x10000)');
            }

            if (metadata.width < 1 || metadata.height < 1) {
                errors.push('Invalid image dimensions');
            }

            // Check for reasonable file size vs dimensions ratio
            const pixelCount = metadata.width * metadata.height;
            const bytesPerPixel = file.size / pixelCount;

            if (bytesPerPixel > 50) { // Suspiciously large bytes per pixel
                errors.push('Image file size suspicious for given dimensions');
            }

            // Check for supported formats
            const supportedFormats = ['jpeg', 'png', 'gif', 'webp'];
            if (!supportedFormats.includes(metadata.format)) {
                errors.push(`Unsupported image format: ${metadata.format}`);
            }

            // Check for animation in static formats
            if (metadata.format === 'gif' && metadata.pages > 1) {
                // Animated GIF - could be used for exploits
                console.warn(`⚠️ Animated GIF detected: ${file.originalname}`);
            }

        } catch (error) {
            console.error('💥 Image validation error:', error.message);
            errors.push('Image file appears to be corrupted or invalid');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Check for executable signatures
    async checkForExecutableSignatures(file) {
        try {
            // Read first 512 bytes for signature analysis
            const fd = await fs.open(file.path, 'r');
            const buffer = Buffer.alloc(512);
            await fd.read(buffer, 0, 512, 0);
            await fd.close();

            // Common executable signatures
            const executableSignatures = [
                Buffer.from([0x4D, 0x5A]), // PE/MZ (Windows executables)
                Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF (Linux executables)
                Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O (macOS executables)
                Buffer.from([0xCE, 0xFA, 0xED, 0xFE]), // Mach-O (reverse)
                Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class files
                Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (could contain executables)
            ];

            for (const signature of executableSignatures) {
                if (buffer.indexOf(signature) === 0) {
                    console.warn(`🚨 Executable signature detected in ${file.originalname}`);
                    return { isExecutable: true, signature: signature.toString('hex') };
                }
            }

            // Check for script shebangs
            const content = buffer.toString('ascii', 0, 100);
            if (content.startsWith('#!')) {
                console.warn(`🚨 Script shebang detected in ${file.originalname}`);
                return { isExecutable: true, signature: 'shebang' };
            }

            return { isExecutable: false };

        } catch (error) {
            console.error('💥 Executable signature check error:', error.message);
            return { isExecutable: false, error: error.message };
        }
    }

    // Validate filename
    validateFilename(filename) {
        const errors = [];

        // Check for dangerous extensions
        const dangerousExtensions = [
            '.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js', '.jar',
            '.com', '.php', '.asp', '.jsp', '.html', '.htm', '.svg'
        ];

        const extension = path.extname(filename).toLowerCase();
        if (dangerousExtensions.includes(extension)) {
            errors.push(`Dangerous file extension: ${extension}`);
        }

        // Check for double extensions
        const extensionCount = (filename.match(/\./g) || []).length;
        if (extensionCount > 1) {
            errors.push('Multiple file extensions not allowed');
        }

        // Check for reserved names (Windows)
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'LPT1', 'LPT2'];
        const baseName = path.basename(filename, extension).toUpperCase();
        if (reservedNames.includes(baseName)) {
            errors.push('Reserved filename not allowed');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Process images (resize, optimize, generate thumbnails)
    async processImages(req) {
        const files = this.getUploadedFiles(req);

        for (const file of files) {
            if (this.isImageFile(file)) {
                try {
                    await this.optimizeImage(file);
                    console.log(`🖼️ Image optimized: ${file.filename}`);
                } catch (error) {
                    console.error(`💥 Image processing error for ${file.filename}:`, error.message);
                    // Don't fail the upload for processing errors
                }
            }
        }
    }

    // Optimize image
    async optimizeImage(file) {
        try {
            const image = sharp(file.path);
            const metadata = await image.metadata();

            // Create optimized version
            const optimizedPath = file.path.replace(/(\.[^.]+)$/, '_optimized$1');

            await image
                .resize({
                    width: Math.min(metadata.width, 2048),
                    height: Math.min(metadata.height, 2048),
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 85, progressive: true })
                .png({ compressionLevel: 8, progressive: true })
                .webp({ quality: 85 })
                .toFile(optimizedPath);

            // Replace original with optimized version if smaller
            const originalStats = await fs.stat(file.path);
            const optimizedStats = await fs.stat(optimizedPath);

            if (optimizedStats.size < originalStats.size) {
                await fs.rename(optimizedPath, file.path);
                file.size = optimizedStats.size;
                console.log(`📉 Image size reduced from ${originalStats.size} to ${optimizedStats.size} bytes`);
            } else {
                await fs.unlink(optimizedPath);
            }

        } catch (error) {
            console.error('💥 Image optimization error:', error.message);
            throw error;
        }
    }

    // Generate file metadata
    async generateFileMetadata(req) {
        const files = this.getUploadedFiles(req);

        for (const file of files) {
            try {
                // Generate file hash for integrity checking
                const hash = await this.generateFileHash(file.path);

                // Add metadata to file object
                file.metadata = {
                    hash,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: req.user?.id,
                    uploadedByRole: req.user?.role,
                    originalSize: file.size,
                    secureFilename: file.filename,
                    mimeType: file.mimetype,
                    isImage: this.isImageFile(file)
                };

                // Add image-specific metadata
                if (this.isImageFile(file)) {
                    try {
                        const imageMetadata = await sharp(file.path).metadata();
                        file.metadata.imageData = {
                            width: imageMetadata.width,
                            height: imageMetadata.height,
                            format: imageMetadata.format,
                            channels: imageMetadata.channels,
                            hasAlpha: imageMetadata.hasAlpha
                        };
                    } catch (error) {
                        console.warn('⚠️ Could not extract image metadata:', error.message);
                    }
                }

                console.log(`📋 Metadata generated for: ${file.filename}`);

            } catch (error) {
                console.error(`💥 Metadata generation error for ${file.filename}:`, error.message);
            }
        }
    }

    // Generate file hash for integrity
    async generateFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
            console.error('💥 Hash generation error:', error.message);
            return null;
        }
    }

    // Scan for malware (placeholder - would integrate with antivirus)
    async scanForMalware(req) {
        // In production, integrate with ClamAV or similar
        console.log('🛡️ Malware scan would run here');
        return { clean: true, scanTime: Date.now() };
    }

    // Quarantine suspicious files
    async quarantineFiles(req) {
        const files = this.getUploadedFiles(req);

        for (const file of files) {
            try {
                const quarantinePath = path.join(this.quarantineDir, `quarantine_${Date.now()}_${file.filename}`);
                await fs.rename(file.path, quarantinePath);
                console.warn(`🚨 File quarantined: ${file.filename} -> ${quarantinePath}`);
            } catch (error) {
                console.error(`💥 Quarantine error for ${file.filename}:`, error.message);
            }
        }
    }

    // Clean up uploaded files
    async cleanupUploadedFiles(req) {
        const files = this.getUploadedFiles(req);

        for (const file of files) {
            try {
                if (file.path) {
                    await fs.unlink(file.path);
                    console.log(`🗑️ Cleaned up file: ${file.filename}`);
                }
            } catch (error) {
                console.error(`💥 Cleanup error for ${file.filename}:`, error.message);
            }
        }
    }

    // Get uploaded files from request
    getUploadedFiles(req) {
        if (req.file) {
            return [req.file];
        } else if (req.files) {
            return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
        }
        return [];
    }

    // Check if file is an image
    isImageFile(file) {
        return file.mimetype && file.mimetype.startsWith('image/');
    }

    // Handle upload errors
    handleUploadError(error, res) {
        console.error('💥 Upload error:', error.message);

        let message = 'File upload failed';
        let statusCode = 400;

        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File size exceeds the allowed limit';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files uploaded';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
            case 'LIMIT_FIELD_KEY':
                message = 'Field name too long';
                break;
            case 'LIMIT_FIELD_VALUE':
                message = 'Field value too long';
                break;
            case 'LIMIT_FIELD_COUNT':
                message = 'Too many fields';
                break;
            case 'LIMIT_PART_COUNT':
                message = 'Too many parts in multipart data';
                break;
            default:
                if (error.message.includes('File type')) {
                    message = error.message;
                } else if (error.message.includes('Potentially malicious')) {
                    message = 'File upload blocked for security reasons';
                    statusCode = 403;
                } else {
                    message = 'File upload processing failed';
                    statusCode = 500;
                }
        }

        return res.status(statusCode).json({
            success: false,
            error: 'Upload Failed',
            message,
            timestamp: new Date().toISOString()
        });
    }

    // Create specific upload middleware types
    singleImage = () => this.createUploadMiddleware({
        fieldName: 'image',
        maxFiles: 1,
        fileType: 'image',
        required: false,
        processImages: true
    });

    multipleFiles = (maxFiles = 5) => this.createUploadMiddleware({
        fieldName: 'files',
        maxFiles,
        fileType: 'any',
        required: false,
        processImages: true
    });

    mixedFields = () => this.createUploadMiddleware({
        fieldName: 'mixed',
        maxFiles: 6, // 1 image + 5 files
        fileType: 'any',
        required: false,
        processImages: true
    });
}

const multerInstance = multer({
    storage: secureUploadConfig.createSecureStorage(),
    fileFilter: secureUploadConfig.createFileFilter(),
    limits: {
        fileSize: secureUploadConfig.maxFileSize,
        files: 6,
        fields: 10
    }
});
const mixedFields = multerInstance.fields([
    { name: 'image', maxCount: 1 },
    { name: 'files', maxCount: 5 }
]);

// Create singleton instance
const uploadMiddleware = new UploadMiddleware();

module.exports = {
    single: uploadMiddleware.createUploadMiddleware.bind(uploadMiddleware),
    singleImage: uploadMiddleware.singleImage(),
    multipleFiles: uploadMiddleware.multipleFiles(),
    mixedFields: uploadMiddleware.mixedFields(),
    mixedFields,

    // Utility functions
    getUploadedFiles: uploadMiddleware.getUploadedFiles.bind(uploadMiddleware),
    cleanupFiles: uploadMiddleware.cleanupUploadedFiles.bind(uploadMiddleware)
};