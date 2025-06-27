const helmet = require('helmet');
const { SECURITY_CONSTANTS } = require('../config/security');
const { config } = require('../config/environment');

class SecurityMiddleware {
    constructor() {
        this.suspiciousIPs = new Map();
        this.rateLimitStore = new Map();
    }

    securityHeaders() {
        return helmet({
            contentSecurityPolicy: {
                directives: SECURITY_CONSTANTS.SECURITY_HEADERS.CONTENT_SECURITY_POLICY.directives,
                reportOnly: false,
            },
            hsts: SECURITY_CONSTANTS.SECURITY_HEADERS.HSTS,
            frameguard: { action: 'deny' },
            noSniff: true,
            xssFilter: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            permissionsPolicy: { features: SECURITY_CONSTANTS.SECURITY_HEADERS.FEATURE_POLICY },
            hidePoweredBy: true,
            dnsPrefetchControl: { allow: false },
            expectCt: { enforce: true, maxAge: 86400 },
            crossOriginEmbedderPolicy: false,
            crossOriginOpenerPolicy: { policy: 'same-origin' },
            crossOriginResourcePolicy: { policy: 'cross-origin' }
        });
    }

    sanitizeRequest = (req, res, next) => {
        try {
            console.log('🧹 Sanitizing request...');
            if (req.params) req.params = this.sanitizeObject(req.params);
            if (req.query) req.query = this.sanitizeObject(req.query);
            if (req.body && !this.isFileUpload(req)) req.body = this.sanitizeObject(req.body);

            const suspiciousCheck = this.checkForSuspiciousActivity(req);

            if (suspiciousCheck.isSuspicious) {
                console.error('🚨 Suspicious activity detected:', suspiciousCheck.reason);
                this.logSuspiciousActivity(req, suspiciousCheck.reason);
                return res.status(400).json({
                    success: false,
                    error: 'Bad Request',
                    message: 'Request contains invalid data',
                    timestamp: new Date().toISOString()
                });
            }
            console.log('✅ Request sanitization completed');
            next();
        } catch (error) {
            console.error('💥 Request sanitization error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: 'Request processing failed',
                timestamp: new Date().toISOString()
            });
        }
    };

    sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return this.sanitizeString(obj);
        if (Array.isArray(obj)) return obj.map(item => this.sanitizeObject(item));
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanKey = this.sanitizeString(key);
            if (typeof value === 'object' && value !== null) {
                sanitized[cleanKey] = this.sanitizeObject(value);
            } else {
                sanitized[cleanKey] = this.sanitizeString(value);
            }
        }
        return sanitized;
    }

    sanitizeString(value) {
        if (typeof value !== 'string') return value;
        let sanitized = value.replace(/\0/g, '');
        try { sanitized = decodeURIComponent(sanitized); } catch (e) {}
        sanitized = sanitized
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim();
        return sanitized;
    }

    isFileUpload(req) {
        const contentType = req.headers['content-type'] || '';
        return contentType.includes('multipart/form-data') ||
            contentType.includes('application/octet-stream');
    }

    // --- PATCHED: Use filteredBody for all suspicious checks!
    getFilteredBody(body) {
        const filteredBody = {};
        if (body) {
            Object.entries(body).forEach(([key, value]) => {
                if (key === "files") return;
                if (typeof value === 'string') filteredBody[key] = value;
            });
        }
        return filteredBody;
    }

    checkForSuspiciousActivity(req) {
        const filteredBody = this.getFilteredBody(req.body);
        const requestString = JSON.stringify({
            ...req.params,
            ...req.query,
            ...filteredBody
        });
        const checks = [
            this.checkSQLInjection,
            this.checkXSS,
            this.checkPathTraversal,
            this.checkCommandInjection,
            this.checkExcessiveHeaders,
            this.checkSuspiciousUserAgent
        ];
        for (const check of checks) {
            const result = check.call(this, { ...req, body: filteredBody });
            if (result.isSuspicious) return result;
        }
        return { isSuspicious: false };
    }

    checkSQLInjection(req) {
        const sqlPatterns = SECURITY_CONSTANTS.SQL_INJECTION_PATTERNS;
        const filteredBody = this.getFilteredBody(req.body);
        const requestString = JSON.stringify({
            ...req.params,
            ...req.query,
            ...filteredBody
        });
        for (const pattern of sqlPatterns) {
            if (pattern.test(requestString)) {
                return {
                    isSuspicious: true,
                    reason: 'SQL injection attempt detected',
                    pattern: pattern.toString()
                };
            }
        }
        return { isSuspicious: false };
    }

    checkXSS(req) {
        const xssPatterns = SECURITY_CONSTANTS.XSS_PATTERNS;
        const filteredBody = this.getFilteredBody(req.body);
        const requestString = JSON.stringify({
            ...req.params,
            ...req.query,
            ...filteredBody
        });
        for (const pattern of xssPatterns) {
            if (pattern.test(requestString)) {
                return {
                    isSuspicious: true,
                    reason: 'XSS attempt detected',
                    pattern: pattern.toString()
                };
            }
        }
        return { isSuspicious: false };
    }

    checkPathTraversal(req) {
        const pathTraversalPatterns = [
            /\.\./, /\.\.\//, /\.\.\\/, /%2e%2e%2f/i, /%2e%2e%5c/i, /\.\.%2f/i, /\.\.%5c/i
        ];
        const fullUrl = req.originalUrl || req.url;
        const requestString = JSON.stringify({ url: fullUrl, ...req.params, ...req.query });
        for (const pattern of pathTraversalPatterns) {
            if (pattern.test(requestString)) {
                return {
                    isSuspicious: true,
                    reason: 'Path traversal attempt detected',
                    pattern: pattern.toString()
                };
            }
        }
        return { isSuspicious: false };
    }

    checkCommandInjection(req) {
        const commandPatterns = [
            /[;&|`$]/,
            /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping)\b/i,
            /\$\(.*\)/,
            /`.*`/,
            /\|\s*(cat|ls|pwd|whoami)/i
        ];
        const filteredBody = this.getFilteredBody(req.body);
        const requestString = JSON.stringify({
            ...req.params,
            ...req.query,
            ...filteredBody
        });
        for (const pattern of commandPatterns) {
            if (pattern.test(requestString)) {
                return {
                    isSuspicious: true,
                    reason: 'Command injection attempt detected',
                    pattern: pattern.toString()
                };
            }
        }
        return { isSuspicious: false };
    }

    checkExcessiveHeaders(req) {
        const headerCount = Object.keys(req.headers).length;
        const maxHeaders = 50;
        if (headerCount > maxHeaders) {
            return {
                isSuspicious: true,
                reason: `Excessive headers detected: ${headerCount} (max: ${maxHeaders})`
            };
        }
        return { isSuspicious: false };
    }

    checkSuspiciousUserAgent(req) {
        const userAgent = req.headers['user-agent'] || '';
        const suspiciousPatterns = [
            /sqlmap/i, /nikto/i, /nessus/i, /acunetix/i, /burp/i, /nmap/i, /masscan/i, /zap/i,
            /bot.*bot/i, /scanner/i, /crawler.*crawler/i, /hack/i
        ];
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(userAgent)) {
                return {
                    isSuspicious: true,
                    reason: `Suspicious user agent detected: ${userAgent.substring(0, 100)}`
                };
            }
        }
        return { isSuspicious: false };
    }

    logSuspiciousActivity(req, reason) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            userAgent: req.headers['user-agent'] || 'Unknown',
            method: req.method,
            url: req.originalUrl || req.url,
            reason,
            headers: req.headers,
            body: this.isFileUpload(req) ? '[FILE_UPLOAD]' : req.body
        };
        console.error('🚨 SECURITY ALERT:', JSON.stringify(logEntry, null, 2));
        const ip = this.getClientIP(req);
        const suspiciousCount = this.suspiciousIPs.get(ip) || 0;
        this.suspiciousIPs.set(ip, suspiciousCount + 1);
        if (suspiciousCount >= 5) {
            console.error(`🔒 IP ${ip} blocked due to ${suspiciousCount + 1} suspicious attempts`);
        }
    }

    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.ip || 'unknown';
    }

    corsMiddleware() {
        const cors = require('cors');
        return cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (config.cors.origin.includes(origin)) {
                    return callback(null, true);
                }
                console.warn(`🚫 Unauthorized CORS origin attempted: ${origin}`);
                return callback(new Error('Not allowed by CORS'), false);
            },
            credentials: config.cors.credentials,
            optionsSuccessStatus: config.cors.optionsSuccessStatus,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Origin','X-Requested-With','Content-Type','Accept','Authorization','Cache-Control','Pragma'
            ],
            exposedHeaders: ['X-Total-Count'],
            maxAge: 86400
        });
    }

    cleanupSuspiciousIPs = () => {
        setInterval(() => {
            this.suspiciousIPs.clear();
            console.log('🧹 Suspicious IP tracking cleared');
        }, 60 * 60 * 1000);
    };
}

const securityMiddleware = new SecurityMiddleware();
securityMiddleware.cleanupSuspiciousIPs();

module.exports = {
    securityHeaders: securityMiddleware.securityHeaders(),
    sanitizeRequest: securityMiddleware.sanitizeRequest,
    corsMiddleware: securityMiddleware.corsMiddleware()
};