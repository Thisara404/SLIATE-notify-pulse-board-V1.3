// Comprehensive security logging middleware
const fs = require('fs').promises;
const path = require('path');
const { config, isDevelopment } = require('../config/environment');

class SecurityLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.securityLogFile = path.join(this.logDir, 'security.log');
        this.accessLogFile = path.join(this.logDir, 'access.log');
        this.errorLogFile = path.join(this.logDir, 'error.log');
        this.auditLogFile = path.join(this.logDir, 'audit.log');

        this.initializeLogs();
    }

    // Initialize log directories and files
    async initializeLogs() {
        try {
            // Create logs directory if it doesn't exist
            try {
                await fs.access(this.logDir);
            } catch (error) {
                await fs.mkdir(this.logDir, { recursive: true });
                console.log('📁 Created logs directory');
            }

            // Initialize log files
            const logFiles = [
                this.securityLogFile,
                this.accessLogFile,
                this.errorLogFile,
                this.auditLogFile
            ];

            for (const logFile of logFiles) {
                try {
                    await fs.access(logFile);
                } catch (error) {
                    await fs.writeFile(logFile, `# Log file created: ${new Date().toISOString()}\n`);
                }
            }

            console.log('📊 Security logging system initialized');
        } catch (error) {
            console.error('💥 Error initializing logs:', error.message);
        }
    }

    // Get client information
    getClientInfo(req) {
        try {
            // Safely access headers
            const headers = req.headers || {};

            const forwarded = headers['x-forwarded-for'];
            const ip = forwarded ? forwarded.split(',')[0].trim() :
                req.connection?.remoteAddress ||
                req.socket?.remoteAddress ||
                req.ip ||
                'unknown';

            return {
                ip,
                userAgent: headers['user-agent'] || 'unknown',
                referer: headers['referer'] || headers['referrer'] || 'direct',
                origin: headers['origin'] || 'unknown',
                realIP: headers['x-real-ip'] || ip,
                forwardedFor: headers['x-forwarded-for'] || 'none'
            };
        } catch (error) {
            console.error('💥 Error in getClientInfo:', error.message);
            return {
                ip: 'unknown',
                userAgent: 'unknown',
                referer: 'direct',
                origin: 'unknown',
                realIP: 'unknown',
                forwardedFor: 'none'
            };
        }
    }

    // Create log entry structure
    createLogEntry(type, req, data = {}) {
        try {
            const clientInfo = this.getClientInfo(req);

            return {
                timestamp: new Date().toISOString(),
                type,
                method: req.method || 'UNKNOWN',
                url: req.originalUrl || req.url || 'unknown',
                path: req.path || 'unknown',
                query: req.query || {},
                params: req.params || {},
                ...clientInfo,
                user: req.user ? {
                    id: req.user.id,
                    username: req.user.username,
                    role: req.user.role
                } : null,
                session: req.sessionID || (req.session && req.session.id) || 'none',
                requestId: req.id || this.generateRequestId(),
                ...data
            };
        } catch (error) {
            console.warn('⚠️ Error in createLogEntry:', error.message);
            return {
                timestamp: new Date().toISOString(),
                type: type || 'UNKNOWN',
                method: 'UNKNOWN',
                url: 'unknown',
                path: 'unknown',
                query: {},
                params: {},
                ip: 'unknown',
                userAgent: 'unknown',
                referer: 'direct',
                origin: 'unknown',
                realIP: 'unknown',
                forwardedFor: 'none',
                user: null,
                session: 'none',
                requestId: this.generateRequestId(),
                error: 'Failed to create log entry',
                originalError: error.message,
                ...data
            };
        }
    }

    // Generate unique request ID
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Write log entry to file
    async writeLogEntry(filename, entry) {
        try {
            const logLine = JSON.stringify(entry) + '\n';
            await fs.appendFile(filename, logLine);

            // In development, also log to console
            if (isDevelopment()) {
                console.log(`📝 ${entry.type}:`, entry);
            }
        } catch (error) {
            console.error('💥 Error writing log entry:', error.message);
        }
    }

    // Security event logging middleware
    securityLogger = (req, res, next) => {
        // Add request ID for tracing
        req.id = this.generateRequestId();

        // Store original end function
        const originalEnd = res.end;
        const startTime = Date.now();

        // Override end function to capture response
        res.end = function (chunk, encoding) {
            const duration = Date.now() - startTime;

            // Create access log entry
            const accessEntry = {
                ...this.createLogEntry('ACCESS', req),
                statusCode: res.statusCode,
                responseTime: duration,
                responseSize: res.get('content-length') || 0,
                success: res.statusCode < 400
            };

            // Log based on response status
            if (res.statusCode >= 400) {
                this.writeLogEntry(this.errorLogFile, {
                    ...accessEntry,
                    type: 'ERROR_RESPONSE'
                });
            }

            this.writeLogEntry(this.accessLogFile, accessEntry);

            // Call original end function
            originalEnd.call(this, chunk, encoding);
        }.bind(this);

        next();
    };

    // Authentication logging
    logAuthentication = (req, result, user = null) => {
        const entry = this.createLogEntry('AUTHENTICATION', req, {
            success: result.success,
            reason: result.reason || 'unknown',
            user: user ? {
                id: user.id,
                username: user.username,
                role: user.role
            } : null,
            attemptedUsername: req.body?.username || 'unknown',
            tokenProvided: !!req.headers.authorization
        });

        this.writeLogEntry(this.securityLogFile, entry);

        // Log failed attempts to security log
        if (!result.success) {
            this.logSecurityEvent(req, 'AUTH_FAILURE', {
                reason: result.reason,
                attemptedUsername: req.body?.username
            });
        }
    };

    // Authorization logging
    logAuthorization = (req, result, requiredRole = null) => {
        const entry = this.createLogEntry('AUTHORIZATION', req, {
            success: result.success,
            reason: result.reason || 'unknown',
            requiredRole,
            userRole: req.user?.role || 'anonymous',
            resource: req.path,
            action: req.method
        });

        this.writeLogEntry(this.securityLogFile, entry);

        // Log authorization failures
        if (!result.success) {
            this.logSecurityEvent(req, 'AUTHZ_FAILURE', {
                reason: result.reason,
                requiredRole,
                userRole: req.user?.role
            });
        }
    };

    // API access logging
    logApiAccess = (req, action = 'API_ACCESS', metadata = {}) => {
        try {
            const entry = this.createLogEntry('API_ACCESS', req, {
                action,
                metadata,
                tokenProvided: !!req.headers.authorization,
                endpoint: req.path,
                authenticated: !!req.user,
                userRole: req.user?.role || 'anonymous',
                contentType: req.get('Content-Type') || 'none',
                acceptHeader: req.get('Accept') || 'none'
            });

            this.writeLogEntry(this.accessLogFile, entry);

            // Log to console in development
            if (isDevelopment()) {
                console.log(`📝 ${action}: ${req.method} ${req.path} - ${req.user?.username || 'anonymous'}`);
            }

            return entry;
        } catch (error) {
            console.error('💥 Error in logApiAccess:', error.message);
            // Don't throw error - logging failure shouldn't break the app
        }
    };

    // File upload logging
    logFileUpload = (req, files, result) => {
        const entry = this.createLogEntry('FILE_UPLOAD', req, {
            success: result.success,
            reason: result.reason || 'success',
            fileCount: files ? files.length : 0,
            files: files ? files.map(file => ({
                originalName: file.originalname,
                filename: file.filename,
                mimetype: file.mimetype,
                size: file.size,
                destination: file.destination
            })) : [],
            totalSize: files ? files.reduce((sum, file) => sum + file.size, 0) : 0
        });

        this.writeLogEntry(this.auditLogFile, entry);

        // Log suspicious uploads
        if (!result.success || (files && files.some(f => f.size > 10 * 1024 * 1024))) {
            this.logSecurityEvent(req, 'SUSPICIOUS_UPLOAD', {
                reason: result.reason,
                fileCount: files ? files.length : 0
            });
        }
    };

    // Data modification logging
    logDataModification = (req, operation, resource, data = {}) => {
        const entry = this.createLogEntry('DATA_MODIFICATION', req, {
            operation, // CREATE, UPDATE, DELETE
            resource, // notices, users, etc.
            resourceId: data.id || req.params.id || 'unknown',
            previousData: data.before || null,
            newData: data.after || null,
            changes: data.changes || null,
            success: data.success !== false
        });

        this.writeLogEntry(this.auditLogFile, entry);
    };

    // Security event logging (threats, attacks, etc.)
    logSecurityEvent = (req, eventType, details = {}) => {
        const entry = this.createLogEntry('SECURITY_EVENT', req, {
            eventType, // XSS_ATTEMPT, SQL_INJECTION, BRUTE_FORCE, etc.
            severity: details.severity || 'medium',
            details,
            blocked: details.blocked !== false,
            riskScore: details.riskScore || 0
        });

        this.writeLogEntry(this.securityLogFile, entry);

        // Alert for high-severity events
        if (details.severity === 'high' || details.severity === 'critical') {
            this.alertSecurityTeam(entry);
        }
    };

    // Rate limit logging
    logRateLimit = (req, limitType, details = {}) => {
        const entry = this.createLogEntry('RATE_LIMIT', req, {
            limitType, // general, auth, upload, etc.
            exceeded: true,
            details,
            windowMs: details.windowMs || 'unknown',
            maxRequests: details.max || 'unknown',
            currentCount: details.count || 'unknown'
        });

        this.writeLogEntry(this.securityLogFile, entry);
    };

    // Input validation logging
    logValidationError = (req, errors) => {
        const entry = this.createLogEntry('VALIDATION_ERROR', req, {
            errors: errors.map(err => ({
                field: err.field || err.param,
                message: err.message || err.msg,
                value: err.value,
                location: err.location
            })),
            errorCount: errors.length,
            isSuspicious: this.isSuspiciousValidationError(errors)
        });

        this.writeLogEntry(this.securityLogFile, entry);
    };

    // Check if validation error is suspicious
    isSuspiciousValidationError(errors) {
        const suspiciousPatterns = [
            /script/i,
            /javascript/i,
            /union.*select/i,
            /drop.*table/i,
            /\.\.\//, // Path traversal
            /<.*>/  // HTML tags
        ];

        return errors.some(err =>
            suspiciousPatterns.some(pattern =>
                pattern.test(err.value || '')
            )
        );
    }

    // Performance logging
    logPerformance = (req, res, duration) => {
        // Only log slow requests
        if (duration > 1000) { // Slower than 1 second
            const entry = this.createLogEntry('PERFORMANCE', req, {
                duration,
                slow: true,
                responseSize: res.get('content-length') || 0,
                statusCode: res.statusCode
            });

            this.writeLogEntry(this.accessLogFile, entry);
        }
    };

    // Error logging
    logError = (req, error, context = {}) => {
        const entry = this.createLogEntry('ERROR', req, {
            error: {
                name: error.name,
                message: error.message,
                stack: isDevelopment() ? error.stack : 'hidden',
                code: error.code || 'unknown'
            },
            context,
            severity: context.severity || 'error'
        });

        this.writeLogEntry(this.errorLogFile, entry);
    };

    // Alert security team (placeholder)
    alertSecurityTeam = (securityEvent) => {
        console.error('🚨 SECURITY ALERT:', {
            type: securityEvent.eventType,
            severity: securityEvent.details.severity,
            ip: securityEvent.ip,
            user: securityEvent.user?.username || 'anonymous',
            timestamp: securityEvent.timestamp
        });

        // In production, send to security monitoring system
        // Could integrate with Slack, email, SIEM, etc.
    };

    // Log cleanup (rotate logs)
    async rotateLogs() {
        const maxLogSize = 100 * 1024 * 1024; // 100MB
        const maxLogAge = 30 * 24 * 60 * 60 * 1000; // 30 days

        const logFiles = [
            this.securityLogFile,
            this.accessLogFile,
            this.errorLogFile,
            this.auditLogFile
        ];

        for (const logFile of logFiles) {
            try {
                const stats = await fs.stat(logFile);

                // Rotate if file is too large or too old
                if (stats.size > maxLogSize || (Date.now() - stats.mtime.getTime()) > maxLogAge) {
                    const timestamp = new Date().toISOString().split('T')[0];
                    const rotatedFile = `${logFile}.${timestamp}`;

                    await fs.rename(logFile, rotatedFile);
                    await fs.writeFile(logFile, `# Log file rotated: ${new Date().toISOString()}\n`);

                    console.log(`🔄 Log rotated: ${path.basename(logFile)}`);
                }
            } catch (error) {
                console.error(`💥 Error rotating log ${logFile}:`, error.message);
            }
        }
    }

    // Start log rotation schedule
    startLogRotation() {
        // Rotate logs daily at 2 AM
        const rotationInterval = 24 * 60 * 60 * 1000; // 24 hours

        setInterval(() => {
            this.rotateLogs();
        }, rotationInterval);

        console.log('🔄 Log rotation scheduled');
    }

    // Get log statistics
    async getLogStats() {
        try {
            const stats = {};

            const logFiles = {
                security: this.securityLogFile,
                access: this.accessLogFile,
                error: this.errorLogFile,
                audit: this.auditLogFile
            };

            for (const [name, file] of Object.entries(logFiles)) {
                try {
                    const fileStats = await fs.stat(file);
                    const content = await fs.readFile(file, 'utf8');
                    const lineCount = content.split('\n').length - 1;

                    stats[name] = {
                        size: fileStats.size,
                        lines: lineCount,
                        lastModified: fileStats.mtime,
                        path: file
                    };
                } catch (error) {
                    stats[name] = { error: error.message };
                }
            }

            return stats;
        } catch (error) {
            console.error('💥 Error getting log stats:', error.message);
            return { error: error.message };
        }
    }
}

// Create singleton instance
const securityLogger = new SecurityLogger();

// Start log rotation
securityLogger.startLogRotation();

module.exports = {
    // Main logging middleware
    securityLogger: securityLogger.securityLogger,

    // Specific logging functions
    logAuthentication: securityLogger.logAuthentication.bind(securityLogger),
    logAuthorization: securityLogger.logAuthorization.bind(securityLogger),
    logFileUpload: securityLogger.logFileUpload.bind(securityLogger),
    logDataModification: securityLogger.logDataModification.bind(securityLogger),
    logSecurityEvent: securityLogger.logSecurityEvent.bind(securityLogger),
    logRateLimit: securityLogger.logRateLimit.bind(securityLogger),
    logValidationError: securityLogger.logValidationError.bind(securityLogger),
    logPerformance: securityLogger.logPerformance.bind(securityLogger),
    logError: securityLogger.logError.bind(securityLogger),
    logApiAccess: securityLogger.logApiAccess.bind(securityLogger),

    // Utility functions
    getLogStats: securityLogger.getLogStats.bind(securityLogger),
    rotateLogs: securityLogger.rotateLogs.bind(securityLogger)
};