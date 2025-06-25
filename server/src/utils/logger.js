// Advanced Security Logger - Comprehensive logging system with security focus
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');

class SecurityLogger {
  constructor() {
    // Log levels with numeric values for filtering
    this.logLevels = {
      EMERGENCY: { value: 0, color: '\x1b[41m', symbol: '🚨' }, // System unusable
      ALERT: { value: 1, color: '\x1b[91m', symbol: '🔴' },     // Action must be taken
      CRITICAL: { value: 2, color: '\x1b[31m', symbol: '💥' },  // Critical conditions
      ERROR: { value: 3, color: '\x1b[91m', symbol: '❌' },     // Error conditions
      WARNING: { value: 4, color: '\x1b[33m', symbol: '⚠️' },   // Warning conditions
      NOTICE: { value: 5, color: '\x1b[36m', symbol: 'ℹ️' },    // Normal but significant
      INFO: { value: 6, color: '\x1b[32m', symbol: '✅' },      // Informational messages
      DEBUG: { value: 7, color: '\x1b[37m', symbol: '🔍' }      // Debug-level messages
    };

    // Event categories for structured logging
    this.eventCategories = {
      AUTHENTICATION: 'auth',
      AUTHORIZATION: 'authz',
      DATA_ACCESS: 'data',
      DATA_MODIFICATION: 'data_mod',
      API_ACCESS: 'api',
      SECURITY: 'security',
      SYSTEM: 'system',
      PERFORMANCE: 'perf',
      USER_ACTION: 'user',
      FILE_OPERATION: 'file',
      DATABASE: 'db',
      NETWORK: 'network'
    };

    // Security event types
    this.securityEventTypes = {
      LOGIN_SUCCESS: 'login_success',
      LOGIN_FAILURE: 'login_failure',
      LOGOUT: 'logout',
      SESSION_CREATED: 'session_created',
      SESSION_EXPIRED: 'session_expired',
      SESSION_REVOKED: 'session_revoked',
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      PERMISSION_DENIED: 'permission_denied',
      SUSPICIOUS_ACTIVITY: 'suspicious_activity',
      RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
      SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
      XSS_ATTEMPT: 'xss_attempt',
      FILE_UPLOAD_THREAT: 'file_upload_threat',
      MALWARE_DETECTED: 'malware_detected',
      DATA_BREACH_ATTEMPT: 'data_breach_attempt',
      ACCOUNT_LOCKOUT: 'account_lockout',
      PASSWORD_CHANGE: 'password_change',
      PRIVILEGE_ESCALATION: 'privilege_escalation',
      CONFIGURATION_CHANGE: 'config_change',
      SECURITY_SCAN: 'security_scan'
    };

    // Log configuration
    this.config = {
      logDirectory: path.join(process.cwd(), 'logs'),
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      enableConsole: process.env.NODE_ENV !== 'production',
      enableFile: true,
      enableSyslog: false,
      logLevel: process.env.LOG_LEVEL || 'INFO',
      enableEncryption: process.env.ENABLE_LOG_ENCRYPTION === 'true',
      enableDigitalSignature: process.env.ENABLE_LOG_SIGNATURE === 'true',
      rotationInterval: '24h',
      enableRemoteLogging: process.env.ENABLE_REMOTE_LOGGING === 'true',
      remoteEndpoint: process.env.REMOTE_LOG_ENDPOINT
    };

    // Initialize logger
    this.initialize();

    // Performance metrics
    this.metrics = {
      totalLogs: 0,
      logsByLevel: {},
      logsByCategory: {},
      errorCount: 0,
      lastLogTime: null,
      averageLogTime: 0
    };

    // Security context tracking
    this.securityContext = {
      sessionId: null,
      userId: null,
      userRole: null,
      ipAddress: null,
      userAgent: null,
      requestId: null
    };

    // Log buffer for batch processing
    this.logBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 5000; // 5 seconds

    // Start periodic operations
    this.startPeriodicOperations();
  }

  /**
   * Initialize logger system
   */
  async initialize() {
    try {
      // Create log directory if it doesn't exist
      await fs.mkdir(this.config.logDirectory, { recursive: true });

      // Initialize log levels counters
      for (const level of Object.keys(this.logLevels)) {
        this.metrics.logsByLevel[level] = 0;
      }

      // Initialize category counters
      for (const category of Object.values(this.eventCategories)) {
        this.metrics.logsByCategory[category] = 0;
      }

      console.log('📊 Security Logger initialized successfully');

    } catch (error) {
      console.error('💥 Logger initialization error:', error.message);
    }
  }

  /**
   * Start periodic operations (log rotation, buffer flushing, etc.)
   */
  startPeriodicOperations() {
    try {
      // Flush log buffer periodically
      setInterval(() => {
        this.flushBuffer();
      }, this.flushInterval);

      // Rotate logs daily
      setInterval(() => {
        this.rotateLogs();
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Generate metrics report
      setInterval(() => {
        this.generateMetricsReport();
      }, 60 * 60 * 1000); // 1 hour

    } catch (error) {
      console.error('💥 Periodic operations setup error:', error.message);
    }
  }

  /**
   * Set security context for current session
   * @param {Object} context - Security context
   */
  setSecurityContext(context) {
    try {
      this.securityContext = {
        ...this.securityContext,
        ...context,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('💥 Security context setting error:', error.message);
    }
  }

  /**
   * Log a message with specified level and category
   * @param {string} level - Log level
   * @param {string} category - Event category
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @param {Object} context - Request context
   */
  async log(level, category, message, data = {}, context = {}) {
    try {
      const startTime = Date.now();

      // Validate log level
      if (!this.logLevels[level]) {
        level = 'INFO';
      }

      // Skip if log level is below configured threshold
      const configuredLevel = this.logLevels[this.config.logLevel].value;
      const messageLevel = this.logLevels[level].value;
      
      if (messageLevel > configuredLevel) {
        return;
      }

      // Create log entry
      const logEntry = await this.createLogEntry(level, category, message, data, context);

      // Add to buffer for batch processing
      this.logBuffer.push(logEntry);

      // Flush buffer if it's full
      if (this.logBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      // Update metrics
      this.updateMetrics(level, category, Date.now() - startTime);

      // Console output if enabled
      if (this.config.enableConsole) {
        this.logToConsole(logEntry);
      }

      // Immediate write for high-priority logs
      if (messageLevel <= 2) { // EMERGENCY, ALERT, CRITICAL
        await this.flushBuffer();
      }

    } catch (error) {
      // Avoid infinite recursion in logger error handling
      console.error('💥 Logging error:', error.message);
    }
  }

  /**
   * Create structured log entry
   * @param {string} level - Log level
   * @param {string} category - Event category
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @param {Object} context - Request context
   * @returns {Object} - Log entry
   */
  async createLogEntry(level, category, message, data, context) {
    try {
      const timestamp = new Date();
      const logId = crypto.randomUUID();

      const logEntry = {
        // Core log information
        id: logId,
        timestamp: timestamp.toISOString(),
        level: level,
        category: category,
        message: message,

        // Security context
        security: {
          ...this.securityContext,
          ...context
        },

        // Application data
        data: this.sanitizeLogData(data),

        // System information
        system: {
          hostname: require('os').hostname(),
          platform: process.platform,
          nodeVersion: process.version,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          pid: process.pid
        },

        // Performance metrics
        performance: {
          logIndex: this.metrics.totalLogs + 1,
          bufferSize: this.logBuffer.length
        }
      };

      // Add stack trace for errors
      if (level === 'ERROR' || level === 'CRITICAL') {
        logEntry.stack = new Error().stack;
      }

      // Add digital signature if enabled
      if (this.config.enableDigitalSignature) {
        logEntry.signature = this.signLogEntry(logEntry);
      }

      return logEntry;

    } catch (error) {
      console.error('💥 Log entry creation error:', error.message);
      return {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        category: 'system',
        message: 'Failed to create log entry',
        error: error.message
      };
    }
  }

  /**
   * Sanitize log data to prevent sensitive information leakage
   * @param {Object} data - Data to sanitize
   * @returns {Object} - Sanitized data
   */
  sanitizeLogData(data) {
    try {
      if (!data || typeof data !== 'object') {
        return data;
      }

      const sensitiveKeys = [
        'password', 'passwd', 'pwd', 'secret', 'key', 'token', 'auth',
        'authorization', 'cookie', 'session', 'ssn', 'social', 'credit',
        'card', 'cvv', 'pin', 'hash', 'salt', 'private', 'confidential'
      ];

      const sanitized = JSON.parse(JSON.stringify(data));

      const sanitizeObject = (obj) => {
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          
          // Check if key contains sensitive information
          if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
            obj[key] = '[REDACTED]';
          } else if (typeof value === 'object' && value !== null) {
            sanitizeObject(value);
          } else if (typeof value === 'string') {
            // Redact potential sensitive patterns
            if (this.isSensitiveValue(value)) {
              obj[key] = '[REDACTED]';
            }
          }
        }
      };

      sanitizeObject(sanitized);
      return sanitized;

    } catch (error) {
      console.error('💥 Data sanitization error:', error.message);
      return { error: 'Failed to sanitize log data' };
    }
  }

  /**
   * Check if value appears to be sensitive
   * @param {string} value - Value to check
   * @returns {boolean} - Whether value is sensitive
   */
  isSensitiveValue(value) {
    try {
      if (typeof value !== 'string' || value.length < 8) {
        return false;
      }

      // Patterns for sensitive data
      const sensitivePatterns = [
        /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64
        /^[a-f0-9]{32,}$/i, // Hex strings (hashes)
        /^\$2[aby]\$\d{2}\$/, // bcrypt hashes
        /^eyJ[A-Za-z0-9+/]/, // JWT tokens
        /^sk_[a-z]+_[A-Za-z0-9]{20,}/, // API keys
        /\d{13,19}/, // Credit card numbers
        /\d{3}-\d{2}-\d{4}/, // SSN
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/ // Email (partial redaction)
      ];

      return sensitivePatterns.some(pattern => pattern.test(value));

    } catch (error) {
      return false;
    }
  }

  /**
   * Sign log entry for integrity verification
   * @param {Object} logEntry - Log entry to sign
   * @returns {string} - Digital signature
   */
  signLogEntry(logEntry) {
    try {
      const logString = JSON.stringify(logEntry, Object.keys(logEntry).sort());
      const secretKey = process.env.LOG_SIGNATURE_KEY || 'default-secret-key';
      
      return crypto
        .createHmac('sha256', secretKey)
        .update(logString)
        .digest('hex');

    } catch (error) {
      console.error('💥 Log signing error:', error.message);
      return 'signature-failed';
    }
  }

  /**
   * Flush log buffer to persistent storage
   */
  async flushBuffer() {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      const logs = [...this.logBuffer];
      this.logBuffer = [];

      // Write to file if enabled
      if (this.config.enableFile) {
        await this.writeToFile(logs);
      }

      // Send to remote logging service if enabled
      if (this.config.enableRemoteLogging) {
        await this.sendToRemote(logs);
      }

    } catch (error) {
      console.error('💥 Buffer flush error:', error.message);
      // Re-add logs to buffer on failure
      this.logBuffer.unshift(...logs);
    }
  }

  /**
   * Write logs to file
   * @param {Array} logs - Array of log entries
   */
  async writeToFile(logs) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const filename = `security-${today}.log`;
      const filepath = path.join(this.config.logDirectory, filename);

      const logLines = logs.map(log => {
        if (this.config.enableEncryption) {
          return this.encryptLogEntry(log);
        }
        return JSON.stringify(log);
      }).join('\n') + '\n';

      await fs.appendFile(filepath, logLines, 'utf8');

      // Check file size and rotate if necessary
      await this.checkFileRotation(filepath);

    } catch (error) {
      console.error('💥 File writing error:', error.message);
      throw error;
    }
  }

  /**
   * Encrypt log entry
   * @param {Object} logEntry - Log entry to encrypt
   * @returns {string} - Encrypted log entry
   */
  encryptLogEntry(logEntry) {
    try {
      const algorithm = 'aes-256-gcm';
      const secretKey = process.env.LOG_ENCRYPTION_KEY || crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipher(algorithm, secretKey, iv);
      
      let encrypted = cipher.update(JSON.stringify(logEntry), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return JSON.stringify({
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: algorithm
      });

    } catch (error) {
      console.error('💥 Log encryption error:', error.message);
      return JSON.stringify(logEntry); // Fallback to unencrypted
    }
  }

  /**
   * Send logs to remote logging service
   * @param {Array} logs - Array of log entries
   */
  async sendToRemote(logs) {
    try {
      if (!this.config.remoteEndpoint) {
        return;
      }

      // Implementation would depend on your remote logging service
      // This is a placeholder for services like Splunk, ELK Stack, etc.
      
      console.log(`📤 Would send ${logs.length} logs to remote endpoint`);

    } catch (error) {
      console.error('💥 Remote logging error:', error.message);
    }
  }

  /**
   * Check if file rotation is needed
   * @param {string} filepath - Path to log file
   */
  async checkFileRotation(filepath) {
    try {
      const stats = await fs.stat(filepath);
      
      if (stats.size > this.config.maxFileSize) {
        await this.rotateFile(filepath);
      }

    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Rotate log file
   * @param {string} filepath - Path to log file to rotate
   */
  async rotateFile(filepath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = filepath.replace('.log', `-${timestamp}.log`);

      await fs.rename(filepath, rotatedPath);

      // Compress old log file
      if (process.env.COMPRESS_LOGS === 'true') {
        await this.compressLogFile(rotatedPath);
      }

      // Clean up old log files
      await this.cleanupOldLogs();

      console.log(`📋 Log file rotated: ${rotatedPath}`);

    } catch (error) {
      console.error('💥 Log rotation error:', error.message);
    }
  }

  /**
   * Compress log file
   * @param {string} filepath - Path to log file to compress
   */
  async compressLogFile(filepath) {
    try {
      const zlib = require('zlib');
      const { pipeline } = require('stream');
      const { promisify } = require('util');
      
      const pipelineAsync = promisify(pipeline);
      
      const source = require('fs').createReadStream(filepath);
      const destination = require('fs').createWriteStream(`${filepath}.gz`);
      const gzip = zlib.createGzip();

      await pipelineAsync(source, gzip, destination);

      // Remove original file after compression
      await fs.unlink(filepath);

      console.log(`🗜️ Log file compressed: ${filepath}.gz`);

    } catch (error) {
      console.error('💥 Log compression error:', error.message);
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('security-') && (file.endsWith('.log') || file.endsWith('.log.gz')))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          stat: null
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          // Skip files that can't be accessed
        }
      }

      // Sort by modification time (oldest first)
      logFiles
        .filter(file => file.stat)
        .sort((a, b) => a.stat.mtime - b.stat.mtime);

      // Remove excess files
      if (logFiles.length > this.config.maxFiles) {
        const filesToRemove = logFiles.slice(0, logFiles.length - this.config.maxFiles);
        
        for (const file of filesToRemove) {
          await fs.unlink(file.path);
          console.log(`🗑️ Removed old log file: ${file.name}`);
        }
      }

    } catch (error) {
      console.error('💥 Log cleanup error:', error.message);
    }
  }

  /**
   * Rotate all log files
   */
  async rotateLogs() {
    try {
      console.log('🔄 Starting log rotation...');
      
      const files = await fs.readdir(this.config.logDirectory);
      const currentLogFiles = files.filter(file => 
        file.startsWith('security-') && 
        file.endsWith('.log') &&
        !file.includes('-2024-') // Don't rotate already rotated files
      );

      for (const file of currentLogFiles) {
        const filepath = path.join(this.config.logDirectory, file);
        await this.rotateFile(filepath);
      }

      console.log('✅ Log rotation completed');

    } catch (error) {
      console.error('💥 Log rotation error:', error.message);
    }
  }

  /**
   * Output log to console with formatting
   * @param {Object} logEntry - Log entry to display
   */
  logToConsole(logEntry) {
    try {
      const levelInfo = this.logLevels[logEntry.level];
      const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
      
      const formatted = `${levelInfo.color}${levelInfo.symbol} [${timestamp}] ${logEntry.level}${'\x1b[0m'} [${logEntry.category}] ${logEntry.message}`;

      if (logEntry.data && Object.keys(logEntry.data).length > 0) {
        console.log(formatted);
        console.log(`${'\x1b[90m'}   Data: ${util.inspect(logEntry.data, { colors: true, depth: 2 })}${'\x1b[0m'}`);
      } else {
        console.log(formatted);
      }

    } catch (error) {
      console.error('💥 Console logging error:', error.message);
    }
  }

    /**
   * Update logging metrics
   * @param {string} level - Log level
   * @param {string} category - Event category
   * @param {number} processingTime - Time taken to process log
   */
  updateMetrics(level, category, processingTime) {
    try {
      this.metrics.totalLogs++;
      this.metrics.logsByLevel[level] = (this.metrics.logsByLevel[level] || 0) + 1;
      this.metrics.logsByCategory[category] = (this.metrics.logsByCategory[category] || 0) + 1;
      this.metrics.lastLogTime = new Date().toISOString();

      // Update average processing time
      const currentAvg = this.metrics.averageLogTime;
      this.metrics.averageLogTime = (currentAvg * (this.metrics.totalLogs - 1) + processingTime) / this.metrics.totalLogs;

      // Track errors
      if (level === 'ERROR' || level === 'CRITICAL') {
        this.metrics.errorCount++;
      }

    } catch (error) {
      console.error('💥 Metrics update error:', error.message);
    }
  }

  /**
   * Generate metrics report
   */
  generateMetricsReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        period: '1h',
        metrics: {
          ...this.metrics,
          bufferStatus: {
            currentSize: this.logBuffer.length,
            maxSize: this.bufferSize,
            utilizationPercent: Math.round((this.logBuffer.length / this.bufferSize) * 100)
          },
          performance: {
            averageLogTime: Math.round(this.metrics.averageLogTime * 100) / 100,
            logsPerSecond: this.metrics.totalLogs / process.uptime(),
            errorRate: this.metrics.errorCount / Math.max(this.metrics.totalLogs, 1) * 100
          }
        }
      };

      // Log the metrics report
      this.log('INFO', this.eventCategories.SYSTEM, 'Logging metrics report', report);

      // Write metrics to separate file
      this.writeMetricsReport(report);

    } catch (error) {
      console.error('💥 Metrics report generation error:', error.message);
    }
  }

  /**
   * Write metrics report to file
   * @param {Object} report - Metrics report
   */
  async writeMetricsReport(report) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const filename = `metrics-${today}.json`;
      const filepath = path.join(this.config.logDirectory, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    } catch (error) {
      console.error('💥 Metrics report writing error:', error.message);
    }
  }

  // Convenience methods for different log levels
  emergency(category, message, data, context) {
    return this.log('EMERGENCY', category, message, data, context);
  }

  alert(category, message, data, context) {
    return this.log('ALERT', category, message, data, context);
  }

  critical(category, message, data, context) {
    return this.log('CRITICAL', category, message, data, context);
  }

  error(category, message, data, context) {
    return this.log('ERROR', category, message, data, context);
  }

  warning(category, message, data, context) {
    return this.log('WARNING', category, message, data, context);
  }

  notice(category, message, data, context) {
    return this.log('NOTICE', category, message, data, context);
  }

  info(category, message, data, context) {
    return this.log('INFO', category, message, data, context);
  }

  debug(category, message, data, context) {
    return this.log('DEBUG', category, message, data, context);
  }

  // Security-specific logging methods
  logAuthentication(req, result, user = null) {
    try {
      const context = this.extractRequestContext(req);
      const eventType = result.success ? this.securityEventTypes.LOGIN_SUCCESS : this.securityEventTypes.LOGIN_FAILURE;

      const data = {
        eventType,
        success: result.success,
        reason: result.reason,
        username: user?.username || 'unknown',
        userRole: user?.role || null,
        timestamp: new Date().toISOString()
      };

      const level = result.success ? 'INFO' : 'WARNING';
      const message = result.success 
        ? `Successful authentication for user: ${user?.username}` 
        : `Failed authentication attempt: ${result.reason}`;

      return this.log(level, this.eventCategories.AUTHENTICATION, message, data, context);

    } catch (error) {
      console.error('💥 Authentication logging error:', error.message);
    }
  }

  logApiAccess(req, operation, additionalData = {}) {
    try {
      const context = this.extractRequestContext(req);
      
      const data = {
        operation,
        method: req.method,
        url: req.originalUrl || req.url,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content-length'],
        responseTime: req.responseTime,
        ...additionalData
      };

      const message = `API access: ${req.method} ${req.originalUrl || req.url}`;

      return this.log('INFO', this.eventCategories.API_ACCESS, message, data, context);

    } catch (error) {
      console.error('💥 API access logging error:', error.message);
    }
  }

  logSecurityEvent(req, eventType, details = {}) {
    try {
      const context = this.extractRequestContext(req);
      
      const data = {
        eventType,
        severity: details.severity || 'medium',
        details,
        timestamp: new Date().toISOString(),
        riskScore: details.riskScore || 0
      };

      const level = this.mapSeverityToLogLevel(details.severity);
      const message = `Security event: ${eventType}`;

      return this.log(level, this.eventCategories.SECURITY, message, data, context);

    } catch (error) {
      console.error('💥 Security event logging error:', error.message);
    }
  }

  logDataModification(context, operation, tableName, details = {}) {
    try {
      const data = {
        operation,
        tableName,
        recordId: details.recordId,
        changes: details.changes,
        oldValues: details.oldValues,
        newValues: details.newValues,
        timestamp: new Date().toISOString()
      };

      const message = `Data ${operation}: ${tableName}${details.recordId ? ` (ID: ${details.recordId})` : ''}`;

      return this.log('INFO', this.eventCategories.DATA_MODIFICATION, message, data, context);

    } catch (error) {
      console.error('💥 Data modification logging error:', error.message);
    }
  }

  logRateLimit(req, endpoint, details = {}) {
    try {
      const context = this.extractRequestContext(req);
      
      const data = {
        endpoint,
        rateLimitType: details.type || 'unknown',
        windowMs: details.windowMs,
        maxRequests: details.max,
        currentRequests: details.current,
        exceeded: details.exceeded || false,
        resetTime: details.resetTime,
        timestamp: new Date().toISOString()
      };

      const level = details.exceeded ? 'WARNING' : 'INFO';
      const message = details.exceeded 
        ? `Rate limit exceeded for ${endpoint}`
        : `Rate limit check for ${endpoint}`;

      return this.log(level, this.eventCategories.SECURITY, message, data, context);

    } catch (error) {
      console.error('💥 Rate limit logging error:', error.message);
    }
  }

  logPerformance(operation, duration, details = {}) {
    try {
      const data = {
        operation,
        duration,
        ...details,
        timestamp: new Date().toISOString()
      };

      const level = duration > 5000 ? 'WARNING' : 'INFO'; // Warn if operation takes > 5 seconds
      const message = `Performance: ${operation} took ${duration}ms`;

      return this.log(level, this.eventCategories.PERFORMANCE, message, data);

    } catch (error) {
      console.error('💥 Performance logging error:', error.message);
    }
  }

  logUserAction(req, action, details = {}) {
    try {
      const context = this.extractRequestContext(req);
      
      const data = {
        action,
        ...details,
        timestamp: new Date().toISOString()
      };

      const message = `User action: ${action}`;

      return this.log('INFO', this.eventCategories.USER_ACTION, message, data, context);

    } catch (error) {
      console.error('💥 User action logging error:', error.message);
    }
  }

  logFileOperation(req, operation, filename, details = {}) {
    try {
      const context = this.extractRequestContext(req);
      
      const data = {
        operation,
        filename,
        fileSize: details.fileSize,
        mimetype: details.mimetype,
        destination: details.destination,
        ...details,
        timestamp: new Date().toISOString()
      };

      const message = `File ${operation}: ${filename}`;

      return this.log('INFO', this.eventCategories.FILE_OPERATION, message, data, context);

    } catch (error) {
      console.error('💥 File operation logging error:', error.message);
    }
  }

  logDatabaseQuery(query, duration, details = {}) {
    try {
      const data = {
        query: query.substring(0, 200), // Limit query length in logs
        duration,
        rowCount: details.rowCount,
        affectedRows: details.affectedRows,
        error: details.error,
        timestamp: new Date().toISOString()
      };

      const level = details.error ? 'ERROR' : 'DEBUG';
      const message = details.error 
        ? `Database query failed: ${details.error}`
        : `Database query executed in ${duration}ms`;

      return this.log(level, this.eventCategories.DATABASE, message, data);

    } catch (error) {
      console.error('💥 Database logging error:', error.message);
    }
  }

  /**
   * Extract request context for logging
   * @param {Object} req - Express request object
   * @returns {Object} - Request context
   */
  extractRequestContext(req) {
    try {
      if (!req) return {};

      return {
        sessionId: req.sessionID || req.session?.id,
        userId: req.user?.id,
        userRole: req.user?.role,
        username: req.user?.username,
        ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        requestId: req.id || req.headers['x-request-id'],
        method: req.method,
        url: req.originalUrl || req.url,
        protocol: req.protocol,
        headers: this.sanitizeHeaders(req.headers)
      };

    } catch (error) {
      console.error('💥 Context extraction error:', error.message);
      return {};
    }
  }

  /**
   * Sanitize HTTP headers for logging
   * @param {Object} headers - HTTP headers
   * @returns {Object} - Sanitized headers
   */
  sanitizeHeaders(headers) {
    try {
      const sanitized = { ...headers };
      
      // Remove sensitive headers
      const sensitiveHeaders = [
        'authorization', 'cookie', 'set-cookie', 'x-api-key',
        'x-auth-token', 'x-access-token', 'authentication'
      ];

      for (const header of sensitiveHeaders) {
        if (sanitized[header]) {
          sanitized[header] = '[REDACTED]';
        }
      }

      return sanitized;

    } catch (error) {
      console.error('💥 Header sanitization error:', error.message);
      return {};
    }
  }

  /**
   * Map severity level to log level
   * @param {string} severity - Severity level
   * @returns {string} - Log level
   */
  mapSeverityToLogLevel(severity) {
    const mapping = {
      'critical': 'CRITICAL',
      'high': 'ERROR',
      'medium': 'WARNING',
      'low': 'NOTICE',
      'info': 'INFO'
    };

    return mapping[severity] || 'INFO';
  }

  /**
   * Search logs by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} - Matching log entries
   */
  async searchLogs(criteria = {}) {
    try {
      console.log('🔍 Searching logs with criteria:', criteria);

      const {
        level,
        category,
        startDate,
        endDate,
        userId,
        ipAddress,
        message,
        limit = 100
      } = criteria;

      // This is a simplified implementation
      // In production, you might want to use a proper log aggregation system
      
      const today = new Date().toISOString().split('T')[0];
      const filename = `security-${today}.log`;
      const filepath = path.join(this.config.logDirectory, filename);

      try {
        const logContent = await fs.readFile(filepath, 'utf8');
        const logLines = logContent.split('\n').filter(line => line.trim());
        
        let results = [];
        
        for (const line of logLines) {
          try {
            const logEntry = JSON.parse(line);
            
            // Apply filters
            if (level && logEntry.level !== level) continue;
            if (category && logEntry.category !== category) continue;
            if (userId && logEntry.security?.userId !== userId) continue;
            if (ipAddress && logEntry.security?.ipAddress !== ipAddress) continue;
            if (message && !logEntry.message.toLowerCase().includes(message.toLowerCase())) continue;
            
            // Date filtering
            if (startDate) {
              const logDate = new Date(logEntry.timestamp);
              const start = new Date(startDate);
              if (logDate < start) continue;
            }
            
            if (endDate) {
              const logDate = new Date(logEntry.timestamp);
              const end = new Date(endDate);
              if (logDate > end) continue;
            }
            
            results.push(logEntry);
            
            if (results.length >= limit) break;
            
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }

        console.log(`✅ Found ${results.length} matching log entries`);
        return results;

      } catch (fileError) {
        console.log('📄 No log file found for today');
        return [];
      }

    } catch (error) {
      console.error('💥 Log search error:', error.message);
      return [];
    }
  }

  /**
   * Get logging statistics
   * @returns {Object} - Logging statistics
   */
  getStatistics() {
    try {
      return {
        ...this.metrics,
        bufferStatus: {
          currentSize: this.logBuffer.length,
          maxSize: this.bufferSize,
          utilizationPercent: Math.round((this.logBuffer.length / this.bufferSize) * 100)
        },
        performance: {
          averageLogTime: Math.round(this.metrics.averageLogTime * 100) / 100,
          logsPerSecond: this.metrics.totalLogs / Math.max(process.uptime(), 1),
          errorRate: (this.metrics.errorCount / Math.max(this.metrics.totalLogs, 1)) * 100
        },
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          logDirectory: this.config.logDirectory,
          configuredLevel: this.config.logLevel
        }
      };

    } catch (error) {
      console.error('💥 Statistics generation error:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Gracefully shutdown logger
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down security logger...');
      
      // Flush remaining logs
      await this.flushBuffer();
      
      // Generate final metrics report
      this.generateMetricsReport();
      
      console.log('✅ Security logger shutdown complete');

    } catch (error) {
      console.error('💥 Logger shutdown error:', error.message);
    }
  }
}

// Create singleton instance
const securityLogger = new SecurityLogger();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await securityLogger.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await securityLogger.shutdown();
  process.exit(0);
});

// Export both the instance and class
module.exports = {
  // Main logging methods
  log: (level, category, message, data, context) => 
    securityLogger.log(level, category, message, data, context),
  
  // Convenience methods
  emergency: (category, message, data, context) => 
    securityLogger.emergency(category, message, data, context),
  
  alert: (category, message, data, context) => 
    securityLogger.alert(category, message, data, context),
  
  critical: (category, message, data, context) => 
    securityLogger.critical(category, message, data, context),
  
  error: (category, message, data, context) => 
    securityLogger.error(category, message, data, context),
  
  warning: (category, message, data, context) => 
    securityLogger.warning(category, message, data, context),
  
  notice: (category, message, data, context) => 
    securityLogger.notice(category, message, data, context),
  
  info: (category, message, data, context) => 
    securityLogger.info(category, message, data, context),
  
  debug: (category, message, data, context) => 
    securityLogger.debug(category, message, data, context),
  
  // Security-specific methods
  logAuthentication: (req, result, user) => 
    securityLogger.logAuthentication(req, result, user),
  
  logApiAccess: (req, operation, additionalData) => 
    securityLogger.logApiAccess(req, operation, additionalData),
  
  logSecurityEvent: (req, eventType, details) => 
    securityLogger.logSecurityEvent(req, eventType, details),
  
  logDataModification: (context, operation, tableName, details) => 
    securityLogger.logDataModification(context, operation, tableName, details),
  
  logRateLimit: (req, endpoint, details) => 
    securityLogger.logRateLimit(req, endpoint, details),
  
  logPerformance: (operation, duration, details) => 
    securityLogger.logPerformance(operation, duration, details),
  
  logUserAction: (req, action, details) => 
    securityLogger.logUserAction(req, action, details),
  
  logFileOperation: (req, operation, filename, details) => 
    securityLogger.logFileOperation(req, operation, filename, details),
  
  logDatabaseQuery: (query, duration, details) => 
    securityLogger.logDatabaseQuery(query, duration, details),
  
  // Utility methods
  setSecurityContext: (context) => 
    securityLogger.setSecurityContext(context),
  
  searchLogs: (criteria) => 
    securityLogger.searchLogs(criteria),
  
  getStatistics: () => 
    securityLogger.getStatistics(),
  
  // Export constants
  LOG_LEVELS: securityLogger.logLevels,
  EVENT_CATEGORIES: securityLogger.eventCategories,
  SECURITY_EVENT_TYPES: securityLogger.securityEventTypes,
  
  // Export the class for advanced usage
  SecurityLogger
};