// Environment configuration with validation
require('dotenv').config();

const requiredEnvVars = [
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'JWT_SECRET'
    // Removed DB_PASSWORD from required since it can be empty for localhost
];

// Validate required environment variables
const validateEnvironment = () => {
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missing.length > 0) {
        console.error('🚨 Missing required environment variables:', missing);
        process.exit(1);
    }

    // Special handling for empty password
    if (!process.env.DB_PASSWORD) {
        console.log('⚠️ No database password set - using empty password for localhost');
    }

    // Validate JWT secret strength
    if (process.env.JWT_SECRET.length < 32) {
        console.error('🚨 JWT_SECRET must be at least 32 characters long');
        process.exit(1);
    }

    console.log('✅ Environment validation passed');
};

// Development environment check
const isDevelopment = () => process.env.NODE_ENV === 'development';
const isProduction = () => process.env.NODE_ENV === 'production';
const isTesting = () => process.env.NODE_ENV === 'test';

// Configuration object
const config = {
    // Server
    PORT: parseInt(process.env.PORT) || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Database - FIXED for empty password
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '', // Allow empty password
        database: process.env.DB_NAME,
        charset: 'utf8mb4',
        timezone: 'Z'
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRE || '7d',
        algorithm: 'HS256',
        issuer: 'simple-notice-system',
        audience: 'notice-users'
    },

    // Security
    security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
        sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
        enableSecurityHeaders: process.env.ENABLE_SECURITY_HEADERS === 'true',
        enableHelmet: process.env.ENABLE_HELMET === 'true',
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    },

    // File Upload
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE) || 5 * 1024 * 1024, // 5MB
        uploadPath: process.env.UPLOAD_PATH || './uploads',
        allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        allowedFileTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed'
        ]
    },

    // CORS
    cors: {
        origin: process.env.ALLOWED_ORIGINS ?
            process.env.ALLOWED_ORIGINS.split(',') :
            ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        optionsSuccessStatus: 200
    },

    // Analytics
    analytics: {
        enabled: process.env.ENABLE_ANALYTICS === 'true',
        googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID,
    },

    // Redis (optional)
    redis: {
        enabled: process.env.ENABLE_REDIS === 'true',
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableSqlLogging: process.env.ENABLE_SQL_LOGGING === 'true'
    }
};

// Export functions and config
module.exports = {
    config,
    validateEnvironment,
    isDevelopment,
    isProduction,
    isTesting
};