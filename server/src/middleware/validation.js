// Comprehensive input validation middleware
const { body, param, query, validationResult } = require('express-validator');
const { securityValidators } = require('../config/security');

class ValidationMiddleware {
    constructor() {
        this.commonPatterns = {
            email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            username: /^[a-zA-Z0-9_-]{3,30}$/,
            slug: /^[a-z0-9-]+$/,
            objectId: /^\d+$/,
            priority: /^(low|medium|high)$/,
            status: /^(draft|published)$/,
            role: /^(admin|super_admin)$/
        };

        // Define custom validators with proper context
        this.customValidators = {
            // Check if value contains XSS
            isNotXSS: function (value) {
                return !securityValidators.containsXSS(value);
            },

            // Check if value contains SQL injection
            isNotSQLInjection: function (value) {
                return !securityValidators.containsSQLInjection(value);
            },

            // Validate password strength
            isStrongPassword: function (value) {
                const validation = securityValidators.validatePassword(value);
                return validation.isValid;
            },

            // Check if slug is unique (would need database check in real implementation)
            isUniqueSlug: async function (value) {
                // This would typically check database
                return /^[a-z0-9-]+$/.test(value);
            },

            // Validate file type
            isValidFileType: function (mimetype, { req }) {
                const isImage = req.body.isImage === 'true';
                return securityValidators.isAllowedFileType(mimetype, isImage);
            }
        };

        // Define custom sanitizers
        this.customSanitizers = {
            // Sanitize HTML content
            sanitizeHtml: (value) => {
                if (typeof value !== 'string') return value;

                // Remove dangerous HTML tags and attributes
                return value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
                    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/vbscript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .trim();
            },

            // Sanitize filename
            sanitizeFilename: (value) => {
                if (typeof value !== 'string') return value;

                return value
                    .replace(/[^a-zA-Z0-9._-]/g, '_')
                    .replace(/_{2,}/g, '_')
                    .replace(/^[._-]+/, '')
                    .replace(/[._-]+$/, '')
                    .substring(0, 255);
            },

            // Sanitize slug
            sanitizeSlug: (value) => {
                if (typeof value !== 'string') return value;

                return value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '-')
                    .replace(/-{2,}/g, '-')
                    .replace(/^-+/, '')
                    .replace(/-+$/, '')
                    .substring(0, 100);
            }
        };

        // Initialize validation rules after patterns are defined
        this.initializeValidationRules();
    }

    // Initialize validation rules with proper context
    initializeValidationRules() {
        // Notice validation rules
        this.noticeValidation = {
            create: [
                body('title')
                    .trim()
                    .notEmpty()
                    .withMessage('Title is required')
                    .isLength({ min: 5, max: 200 })
                    .withMessage('Title must be between 5 and 200 characters')
                    .custom((value) => {
                        if (value.length > 200) {
                            throw new Error(`Title is too long (${value.length} characters). Maximum is 200 characters.`);
                        }
                        return true;
                    })
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Title contains potentially dangerous content'),

                body('description')
                    .trim()
                    .notEmpty()
                    .withMessage('Description is required')
                    .isLength({ min: 10, max: 10000 })
                    .withMessage('Description must be between 10 and 10000 characters')
                    .custom((value) => {
                        if (value.length > 10000) {
                            throw new Error(`Description is too long (${value.length} characters). Maximum is 10000 characters.`);
                        }
                        return true;
                    })
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Description contains potentially dangerous content'),

                body('priority')
                    .optional()
                    .matches(this.commonPatterns.priority)
                    .withMessage('Priority must be low, medium, or high'),

                body('status')
                    .optional()
                    .matches(this.commonPatterns.status)
                    .withMessage('Status must be draft or published'),

                this.handleValidationErrors
            ],

            update: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                body('title')
                    .optional()
                    .trim()
                    .isLength({ min: 5, max: 200 })
                    .withMessage('Title must be between 5 and 200 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Title contains potentially dangerous content'),

                body('description')
                    .optional()
                    .trim()
                    .isLength({ min: 10, max: 10000 })
                    .withMessage('Description must be between 10 and 10000 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Description contains potentially dangerous content'),

                body('priority')
                    .optional()
                    .matches(this.commonPatterns.priority)
                    .withMessage('Priority must be low, medium, or high'),

                body('status')
                    .optional()
                    .matches(this.commonPatterns.status)
                    .withMessage('Status must be draft or published'),

                this.handleValidationErrors
            ],

            getById: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                this.handleValidationErrors
            ],

            search: [
                query('q')
                    .trim()
                    .notEmpty()
                    .withMessage('Search query is required')
                    .isLength({ min: 3, max: 100 })
                    .withMessage('Search query must be between 3 and 100 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Search query contains potentially dangerous content'),

                query('page')
                    .optional()
                    .isInt({ min: 1 })
                    .withMessage('Page must be a positive integer')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 100 })
                    .withMessage('Limit must be between 1 and 100')
                    .toInt(),

                query('published_only')
                    .optional()
                    .isBoolean()
                    .withMessage('Published only must be a boolean')
                    .toBoolean(),

                this.handleValidationErrors
            ],

            publish: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                this.handleValidationErrors
            ],

            unpublish: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                this.handleValidationErrors
            ],

            delete: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                this.handleValidationErrors
            ],

            getRelated: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 10 })
                    .withMessage('Limit must be between 1 and 10')
                    .toInt(),

                this.handleValidationErrors
            ],

            getBySlug: [
                param('slug')
                    .matches(this.commonPatterns.slug)
                    .withMessage('Invalid slug format')
                    .customSanitizer(this.customSanitizers.sanitizeSlug),

                this.handleValidationErrors
            ]
        };

        // Analytics validation rules
        this.analyticsValidation = {
            // Validation for getting notice analytics
            getNotice: [
                param('id')
                    .notEmpty()
                    .withMessage('Notice ID is required')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID format')
                    .toInt(),
            
                query('start_date')
                    .optional()
                    .isISO8601()
                    .withMessage('Start date must be a valid date in ISO format (YYYY-MM-DD)')
                    .toDate(),
            
                query('end_date')
                    .optional()
                    .isISO8601()
                    .withMessage('End date must be a valid date in ISO format (YYYY-MM-DD)')
                    .toDate(),
            
                query('group_by')
                    .optional()
                    .isIn(['day', 'week', 'month'])
                    .withMessage('Group by must be day, week, or month'),
            
                this.handleValidationErrors
            ],

            // Validation for site analytics
            getSite: [
                query('start_date')
                    .optional()
                    .isISO8601()
                    .withMessage('Start date must be a valid date in ISO format (YYYY-MM-DD)')
                    .toDate(),
            
                query('end_date')
                    .optional()
                    .isISO8601()
                    .withMessage('End date must be a valid date in ISO format (YYYY-MM-DD)')
                    .toDate(),
            
                query('group_by')
                    .optional()
                    .isIn(['day', 'week', 'month'])
                    .withMessage('Group by must be day, week, or month'),
            
                this.handleValidationErrors
            ],

            // Validation for content analytics
            getContent: [
                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 50 })
                    .withMessage('Limit must be between 1 and 50')
                    .toInt(),
            
                this.handleValidationErrors
            ],

            // Validation for exporting analytics data
            export: [
                query('type')
                    .isIn(['notices', 'visits', 'users', 'all'])
                    .withMessage('Type must be notices, visits, users, or all'),
            
                query('format')
                    .isIn(['csv', 'json', 'excel'])
                    .withMessage('Format must be csv, json, or excel'),
            
                query('start_date')
                    .optional()
                    .isISO8601()
                    .withMessage('Start date must be a valid date in ISO format (YYYY-MM-DD)')
                    .toDate(),
            
                query('end_date')
                    .optional()
                    .isISO8601()
                    .withMessage('End date must be a valid date in ISO format (YYYY-MM-DD)')
                    .toDate(),
            
                this.handleValidationErrors
            ]
        };

        // Public routes validation
        this.publicValidation = {
            getNotices: [
                query('page')
                    .optional()
                    .isInt({ min: 1 })
                    .withMessage('Page must be a positive integer')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 50 })
                    .withMessage('Limit must be between 1 and 50')
                    .toInt(),

                query('priority')
                    .optional()
                    .matches(this.commonPatterns.priority)
                    .withMessage('Priority must be low, medium, or high'),

                query('search')
                    .optional()
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Search query contains potentially dangerous content'),

                this.handleValidationErrors
            ],

            getBySlug: [
                param('slug')
                    .matches(this.commonPatterns.slug)
                    .withMessage('Invalid slug format')
                    .customSanitizer(this.customSanitizers.sanitizeSlug),

                this.handleValidationErrors
            ],

            search: [
                query('q')
                    .trim()
                    .notEmpty()
                    .withMessage('Search query is required')
                    .isLength({ min: 3, max: 100 })
                    .withMessage('Search query must be between 3 and 100 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Search query contains potentially dangerous content'),

                query('page')
                    .optional()
                    .isInt({ min: 1 })
                    .withMessage('Page must be a positive integer')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 50 })
                    .withMessage('Limit must be between 1 and 50')
                    .toInt(),

                this.handleValidationErrors
            ],

            getByPriority: [
                param('priority')
                    .matches(this.commonPatterns.priority)
                    .withMessage('Priority must be low, medium, or high'),

                query('page')
                    .optional()
                    .isInt({ min: 1 })
                    .withMessage('Page must be a positive integer')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 50 })
                    .withMessage('Limit must be between 1 and 50')
                    .toInt(),

                this.handleValidationErrors
            ],

            getLatest: [
                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 20 })
                    .withMessage('Limit must be between 1 and 20')
                    .toInt(),

                this.handleValidationErrors
            ],

            getPopular: [
                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 20 })
                    .withMessage('Limit must be between 1 and 20')
                    .toInt(),

                query('days')
                    .optional()
                    .isInt({ min: 1, max: 90 })
                    .withMessage('Days must be between 1 and 90')
                    .toInt(),

                this.handleValidationErrors
            ],

            getArchive: [
                query('year')
                    .optional()
                    .isInt({ min: 2020, max: 2050 })
                    .withMessage('Year must be between 2020 and 2050')
                    .toInt(),

                query('month')
                    .optional()
                    .isInt({ min: 1, max: 12 })
                    .withMessage('Month must be between 1 and 12')
                    .toInt(),

                this.handleValidationErrors
            ]
        };

        // Upload validation rules
        this.uploadValidation = {
            image: [
                body('description')
                    .optional()
                    .isLength({ max: 500 })
                    .withMessage('Description must not exceed 500 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml),

                this.handleValidationErrors
            ],

            files: [
                body('descriptions')
                    .optional()
                    .isArray()
                    .withMessage('Descriptions must be an array'),

                body('descriptions.*')
                    .optional()
                    .isLength({ max: 500 })
                    .withMessage('Each description must not exceed 500 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml),

                this.handleValidationErrors
            ],

            list: [
                query('page')
                    .optional()
                    .isInt({ min: 1 })
                    .withMessage('Page must be a positive integer')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 100 })
                    .withMessage('Limit must be between 1 and 100')
                    .toInt(),

                query('type')
                    .optional()
                    .isIn(['image', 'document', 'all'])
                    .withMessage('Type must be image, document, or all'),

                this.handleValidationErrors
            ],

            delete: [
                param('filename')
                    .notEmpty()
                    .withMessage('Filename is required')
                    .customSanitizer(this.customSanitizers.sanitizeFilename),

                this.handleValidationErrors
            ]
        };

        // Auth validation rules
        this.authValidation = {
            login: [
                body('username')
                    .trim()
                    .matches(this.commonPatterns.username)
                    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores and hyphens'),

                body('password')
                    .isLength({ min: 8, max: 128 })
                    .withMessage('Password must be 8-128 characters'),

                this.handleValidationErrors
            ],

            register: [
                body('username')
                    .trim()
                    .matches(this.commonPatterns.username)
                    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores and hyphens'),

                body('email')
                    .trim()
                    .matches(this.commonPatterns.email)
                    .withMessage('Email must be valid'),

                body('password')
                    .isLength({ min: 8, max: 128 })
                    .withMessage('Password must be 8-128 characters')
                    .custom(this.customValidators.isStrongPassword)
                    .withMessage('Password is not strong enough'),

                body('full_name')
                    .trim()
                    .isLength({ min: 3, max: 100 })
                    .withMessage('Full name must be 3-100 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml),

                body('role')
                    .optional()
                    .matches(this.commonPatterns.role)
                    .withMessage('Role must be admin or super_admin'),

                this.handleValidationErrors
            ],

            changePassword: [
                body('current_password')
                    .notEmpty()
                    .withMessage('Current password is required'),

                body('new_password')
                    .isLength({ min: 8, max: 128 })
                    .withMessage('New password must be 8-128 characters')
                    .custom(this.customValidators.isStrongPassword)
                    .withMessage('New password is not strong enough'),

                body('confirm_password')
                    .custom((value, { req }) => value === req.body.new_password)
                    .withMessage('Passwords do not match'),

                this.handleValidationErrors
            ],

            resetPassword: [
                body('token')
                    .notEmpty()
                    .withMessage('Reset token is required'),

                body('password')
                    .isLength({ min: 8, max: 128 })
                    .withMessage('Password must be 8-128 characters')
                    .custom(this.customValidators.isStrongPassword)
                    .withMessage('Password is not strong enough'),

                body('confirm_password')
                    .custom((value, { req }) => value === req.body.password)
                    .withMessage('Passwords do not match'),

                this.handleValidationErrors
            ]
        };

        // Generic ID parameter validation
        this.validateId = [
            param('id')
                .matches(this.commonPatterns.objectId)
                .withMessage('Invalid ID format')
                .toInt(),

            this.handleValidationErrors
        ];
    }

    // Handle validation errors
    handleValidationErrors = (req, res, next) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                const formattedErrors = errors.array().map(error => {
                    // Create more user-friendly error messages
                    let errorMsg = error.msg;
                    
                    // Special handling for common cases
                    if (error.path === 'title' && error.msg.includes('must be between')) {
                        errorMsg = `Title length issue: ${error.value ? error.value.length : 0} characters (should be 5-200 characters)`;
                    }
                    
                    if (error.path === 'description' && error.msg.includes('must be between')) {
                        errorMsg = `Description length issue: ${error.value ? error.value.length : 0} characters (should be 10-10000 characters)`;
                    }
                    
                    return {
                        field: error.path || error.param,
                        message: errorMsg,
                        value: error.value ? 
                            (typeof error.value === 'string' ? 
                                (error.value.length > 50 ? error.value.substring(0, 50) + '...' : error.value) 
                                : 'non-string value') 
                            : null,
                        location: error.location
                    };
                });

                console.log('🚫 Validation errors:', formattedErrors);

                // Group errors by field for easier client handling
                const groupedErrors = formattedErrors.reduce((acc, error) => {
                    if (!acc[error.field]) {
                        acc[error.field] = [];
                    }
                    acc[error.field].push(error.message);
                    return acc;
                }, {});

                return res.status(400).json({
                    success: false,
                    reason: 'validation_failed',
                    error: 'Validation Error',
                    message: 'Request validation failed',
                    errors: formattedErrors,
                    groupedErrors: groupedErrors,
                    timestamp: new Date().toISOString()
                });
            }

            console.log('✅ Validation passed');
            next();
        } catch (error) {
            console.error('💥 Validation middleware error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: 'Validation processing failed',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Validate request size
    validateRequestSize = (maxSize = 1024 * 1024) => { // 1MB default
        return (req, res, next) => {
            const contentLength = parseInt(req.headers['content-length'] || '0');

            if (contentLength > maxSize) {
                return res.status(413).json({
                    success: false,
                    error: 'Request Too Large',
                    message: `Request size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`,
                    timestamp: new Date().toISOString()
                });
            }

            next();
        };
    };

    // Validate JSON structure
    validateJSON = (req, res, next) => {
        if (req.headers['content-type']?.includes('application/json')) {
            try {
                if (req.body && typeof req.body === 'string') {
                    req.body = JSON.parse(req.body);
                }
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid JSON',
                    message: 'Request body contains invalid JSON',
                    timestamp: new Date().toISOString()
                });
            }
        }
        next();
    };

    // Sanitize all inputs
    sanitizeAll = (req, res, next) => {
        try {
            // Sanitize params
            if (req.params) {
                for (const [key, value] of Object.entries(req.params)) {
                    if (typeof value === 'string') {
                        req.params[key] = this.customSanitizers.sanitizeHtml(value);
                    }
                }
            }

            // Sanitize query
            if (req.query) {
                for (const [key, value] of Object.entries(req.query)) {
                    if (typeof value === 'string') {
                        req.query[key] = this.customSanitizers.sanitizeHtml(value);
                    }
                }
            }

            // Sanitize body (except for file uploads)
            if (req.body && !req.headers['content-type']?.includes('multipart/form-data')) {
                req.body = this.sanitizeObjectRecursive(req.body);
            }

            next();
        } catch (error) {
            console.error('💥 Sanitization error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: 'Request sanitization failed',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Recursively sanitize object
    sanitizeObjectRecursive = (obj) => {
        if (typeof obj === 'string') {
            return this.customSanitizers.sanitizeHtml(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObjectRecursive(item));
        }

        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeObjectRecursive(value);
            }
            return sanitized;
        }

        return obj;
    };
}

// Create singleton instance
const validationMiddleware = new ValidationMiddleware();

module.exports = {
    auth: validationMiddleware.authValidation,
    notice: validationMiddleware.noticeValidation,
    public: validationMiddleware.publicValidation,
    upload: validationMiddleware.uploadValidation,
    analytics: validationMiddleware.analyticsValidation,
    validateId: validationMiddleware.validateId,
    validateRequestSize: validationMiddleware.validateRequestSize,
    validateJSON: validationMiddleware.validateJSON,
    sanitizeAll: validationMiddleware.sanitizeAll,
    handleValidationErrors: validationMiddleware.handleValidationErrors
};