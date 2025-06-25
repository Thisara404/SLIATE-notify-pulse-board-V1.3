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
                // For now, just validate format
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
        // Auth validation rules
        this.authValidation = {
            login: [
                body('username')
                    .trim()
                    .notEmpty()
                    .withMessage('Username is required')
                    .isLength({ min: 3, max: 30 })
                    .withMessage('Username must be between 3 and 30 characters')
                    .matches(this.commonPatterns.username)
                    .withMessage('Username contains invalid characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Username contains potentially dangerous content')
                    .custom(this.customValidators.isNotSQLInjection)
                    .withMessage('Username contains invalid patterns'),

                body('password')
                    .notEmpty()
                    .withMessage('Password is required')
                    .isLength({ min: 8, max: 128 })
                    .withMessage('Password must be between 8 and 128 characters'),

                this.handleValidationErrors
            ],

            register: [
                body('username')
                    .trim()
                    .notEmpty()
                    .withMessage('Username is required')
                    .isLength({ min: 3, max: 30 })
                    .withMessage('Username must be between 3 and 30 characters')
                    .matches(this.commonPatterns.username)
                    .withMessage('Username must contain only letters, numbers, underscores, and hyphens')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Username contains potentially dangerous content'),

                body('email')
                    .trim()
                    .notEmpty()
                    .withMessage('Email is required')
                    .isEmail()
                    .withMessage('Must be a valid email address')
                    .normalizeEmail()
                    .isLength({ max: 255 })
                    .withMessage('Email must not exceed 255 characters')
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Email contains potentially dangerous content'),

                body('password')
                    .notEmpty()
                    .withMessage('Password is required')
                    .custom(this.customValidators.isStrongPassword)
                    .withMessage('Password does not meet security requirements'),

                body('fullName')
                    .trim()
                    .notEmpty()
                    .withMessage('Full name is required')
                    .isLength({ min: 2, max: 100 })
                    .withMessage('Full name must be between 2 and 100 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Full name contains potentially dangerous content'),

                body('role')
                    .optional()
                    .matches(this.commonPatterns.role)
                    .withMessage('Invalid role specified'),

                this.handleValidationErrors
            ]
        };

        // Notice validation rules
        this.noticeValidation = {
            create: [
                body('title')
                    .trim()
                    .notEmpty()
                    .withMessage('Title is required')
                    .isLength({ min: 5, max: 255 })
                    .withMessage('Title must be between 5 and 255 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Title contains potentially dangerous content')
                    .custom(this.customValidators.isNotSQLInjection)
                    .withMessage('Title contains invalid patterns'),

                body('description')
                    .trim()
                    .notEmpty()
                    .withMessage('Description is required')
                    .isLength({ min: 10, max: 5000 })
                    .withMessage('Description must be between 10 and 5000 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Description contains potentially dangerous content')
                    .custom(this.customValidators.isNotSQLInjection)
                    .withMessage('Description contains invalid patterns'),

                body('priority')
                    .optional()
                    .matches(this.commonPatterns.priority)
                    .withMessage('Priority must be low, medium, or high'),

                body('status')
                    .optional()
                    .matches(this.commonPatterns.status)
                    .withMessage('Status must be draft or published'),

                body('slug')
                    .optional()
                    .customSanitizer(this.customSanitizers.sanitizeSlug)
                    .matches(this.commonPatterns.slug)
                    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
                    .isLength({ min: 3, max: 100 })
                    .withMessage('Slug must be between 3 and 100 characters'),

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
                    .isLength({ min: 5, max: 255 })
                    .withMessage('Title must be between 5 and 255 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Title contains potentially dangerous content'),

                body('description')
                    .optional()
                    .trim()
                    .isLength({ min: 10, max: 5000 })
                    .withMessage('Description must be between 10 and 5000 characters')
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

            delete: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                this.handleValidationErrors
            ],

            getById: [
                param('id')
                    .matches(this.commonPatterns.objectId)
                    .withMessage('Invalid notice ID')
                    .toInt(),

                this.handleValidationErrors
            ],

            getBySlug: [
                param('slug')
                    .matches(this.commonPatterns.slug)
                    .withMessage('Invalid slug format')
                    .isLength({ min: 3, max: 100 })
                    .withMessage('Slug must be between 3 and 100 characters'),

                this.handleValidationErrors
            ]
        };

        // Query parameter validation
        this.queryValidation = {
            pagination: [
                query('page')
                    .optional()
                    .isInt({ min: 1, max: 1000 })
                    .withMessage('Page must be a positive integer (max 1000)')
                    .toInt(),

                query('limit')
                    .optional()
                    .isInt({ min: 1, max: 100 })
                    .withMessage('Limit must be between 1 and 100')
                    .toInt(),

                query('sort')
                    .optional()
                    .isIn(['created_at', 'updated_at', 'title', 'priority'])
                    .withMessage('Invalid sort field'),

                query('order')
                    .optional()
                    .isIn(['asc', 'desc'])
                    .withMessage('Order must be asc or desc'),

                this.handleValidationErrors
            ],

            search: [
                query('q')
                    .optional()
                    .trim()
                    .isLength({ min: 1, max: 100 })
                    .withMessage('Search query must be between 1 and 100 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml)
                    .custom(this.customValidators.isNotXSS)
                    .withMessage('Search query contains potentially dangerous content')
                    .custom(this.customValidators.isNotSQLInjection)
                    .withMessage('Search query contains invalid patterns'),

                query('status')
                    .optional()
                    .isIn(['draft', 'published', 'all'])
                    .withMessage('Status filter must be draft, published, or all'),

                query('priority')
                    .optional()
                    .isIn(['low', 'medium', 'high', 'all'])
                    .withMessage('Priority filter must be low, medium, high, or all'),

                this.handleValidationErrors
            ]
        };

        // File upload validation
        this.fileValidation = {
            single: [
                body('description')
                    .optional()
                    .trim()
                    .isLength({ max: 500 })
                    .withMessage('File description must not exceed 500 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml),

                this.handleValidationErrors
            ],

            multiple: [
                body('descriptions')
                    .optional()
                    .isArray()
                    .withMessage('Descriptions must be an array'),

                body('descriptions.*')
                    .optional()
                    .trim()
                    .isLength({ max: 500 })
                    .withMessage('Each file description must not exceed 500 characters')
                    .customSanitizer(this.customSanitizers.sanitizeHtml),

                this.handleValidationErrors
            ]
        };

        // Analytics validation
        this.analyticsValidation = {
            getStats: [
                query('startDate')
                    .optional()
                    .isISO8601()
                    .withMessage('Start date must be a valid ISO 8601 date')
                    .toDate(),

                query('endDate')
                    .optional()
                    .isISO8601()
                    .withMessage('End date must be a valid ISO 8601 date')
                    .toDate(),

                query('groupBy')
                    .optional()
                    .isIn(['day', 'week', 'month'])
                    .withMessage('Group by must be day, week, or month'),

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
                const formattedErrors = errors.array().map(error => ({
                    field: error.path || error.param,
                    message: error.msg,
                    value: error.value,
                    location: error.location
                }));

                console.log('🚫 Validation errors:', formattedErrors);

                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Request validation failed',
                    errors: formattedErrors,
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
    query: validationMiddleware.queryValidation,
    file: validationMiddleware.fileValidation,
    analytics: validationMiddleware.analyticsValidation,
    validateId: validationMiddleware.validateId,
    validateRequestSize: validationMiddleware.validateRequestSize,
    validateJSON: validationMiddleware.validateJSON,
    sanitizeAll: validationMiddleware.sanitizeAll,
    handleValidationErrors: validationMiddleware.handleValidationErrors
};