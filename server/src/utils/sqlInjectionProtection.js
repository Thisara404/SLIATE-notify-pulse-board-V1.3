// SQL Injection Protection - Advanced security against SQL injection attacks
const { logSecurityEvent } = require('../middleware/logging');

class SQLInjectionProtection {
  constructor() {
    // Common SQL injection patterns
    this.sqlPatterns = [
      // Basic SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,
      /(['"])\s*(OR|AND)\s*\1\s*=\s*\1/i,
      /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE))/i,
      
      // Advanced SQL injection patterns
      /(\|\||\|)/i, // Pipe operators
      /(CONCAT\s*\()/i, // String concatenation
      /(CAST\s*\()/i, // Type casting
      /(CONVERT\s*\()/i, // Type conversion
      /(SUBSTRING\s*\()/i, // String manipulation
      /(ASCII\s*\()/i, // ASCII functions
      /(CHAR\s*\()/i, // Character functions
      /(HEX\s*\()/i, // Hexadecimal functions
      
      // Time-based SQL injection
      /(SLEEP\s*\(|WAITFOR\s+DELAY|BENCHMARK\s*\()/i,
      /(pg_sleep\s*\()/i, // PostgreSQL sleep
      
      // Blind SQL injection
      /(IF\s*\(.*,.*,.*\))/i,
      /(CASE\s+WHEN)/i,
      
      // Union-based injection
      /(UNION\s+(ALL\s+)?SELECT)/i,
      
      // Error-based injection
      /(GROUP\s+BY\s+.*\s+HAVING)/i,
      /(ORDER\s+BY\s+\d+)/i,
      
      // Database-specific patterns
      /(@@VERSION|@@SERVERNAME|@@ROWCOUNT)/i, // SQL Server
      /(INFORMATION_SCHEMA|mysql\.user|pg_catalog)/i, // Database schemas
      /(LOAD_FILE\s*\(|INTO\s+OUTFILE)/i, // File operations
      
      // Comment patterns used in injection
      /(--\s|#|\*\/)/,
      /(\s\/\*.*\*\/)/,
      
      // Encoded injection attempts
      /(%27|%22|%3B|%2C)/i, // URL encoded quotes, semicolons, commas
      /(&#x27;|&#x22;|&#39;|&#34;)/i, // HTML encoded quotes
      
      // Boolean-based blind injection
      /(AND\s+\d+=\d+|OR\s+\d+=\d+)/i,
      /(AND\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
      
      // Stacked queries
      /(;\s*EXEC\s*\(|;\s*EXECUTE\s*\()/i,
      
      // Database function calls that shouldn't be in user input
      /(USER\s*\(\)|DATABASE\s*\(\)|VERSION\s*\(\))/i,
      /(@@\w+)/i, // SQL Server system variables
      /(CURRENT_USER|SESSION_USER|SYSTEM_USER)/i,
      
      // Suspicious parentheses patterns
      /(\(\s*SELECT\s+)/i,
      /(\)\s*;)/i
    ];

    // Dangerous SQL keywords that should never appear in user input
    this.dangerousKeywords = [
      'EXEC', 'EXECUTE', 'SP_EXECUTESQL', 'XP_CMDSHELL',
      'SP_OACreate', 'SP_OAMethod', 'SP_OADestroy',
      'OPENROWSET', 'OPENDATASOURCE', 'OPENQUERY',
      'BULK', 'INSERT', 'BCP', 'CMDSHELL'
    ];

    // Context-aware validation patterns
    this.contextPatterns = {
      // Patterns that are dangerous in WHERE clauses
      whereClause: [
        /(OR\s+1\s*=\s*1|AND\s+1\s*=\s*1)/i,
        /(OR\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i
      ],
      
      // Patterns dangerous in ORDER BY clauses
      orderBy: [
        /(UNION|SELECT|INSERT|UPDATE|DELETE)/i,
        /(\(.*SELECT.*\))/i
      ],
      
      // Patterns dangerous in LIMIT clauses
      limit: [
        /[^\d\s,]/i, // Only digits, spaces, and commas allowed
        /(UNION|SELECT)/i
      ]
    };
  }

  /**
   * Scan input for SQL injection patterns
   * @param {string} input - User input to scan
   * @param {Object} context - Context information (IP, user, etc.)
   * @param {string} fieldName - Name of the field being validated
   * @returns {Object} - Scan results
   */
  scanForSQLInjection(input, context = {}, fieldName = 'unknown') {
    try {
      if (!input || typeof input !== 'string') {
        return { safe: true, threats: [] };
      }

      const threats = [];
      const normalizedInput = input.toLowerCase().trim();

      // Check against SQL injection patterns
      for (let i = 0; i < this.sqlPatterns.length; i++) {
        const pattern = this.sqlPatterns[i];
        if (pattern.test(input)) {
          threats.push({
            type: 'SQL_INJECTION_PATTERN',
            pattern: pattern.toString(),
            severity: 'high',
            position: input.search(pattern),
            match: input.match(pattern)?.[0]
          });
        }
      }

      // Check for dangerous keywords
      for (const keyword of this.dangerousKeywords) {
        if (normalizedInput.includes(keyword.toLowerCase())) {
          threats.push({
            type: 'DANGEROUS_SQL_KEYWORD',
            keyword: keyword,
            severity: 'critical',
            position: normalizedInput.indexOf(keyword.toLowerCase())
          });
        }
      }

      // Check for multiple suspicious characters
      const suspiciousChars = (input.match(/[';\"\\]/g) || []).length;
      if (suspiciousChars > 2) {
        threats.push({
          type: 'MULTIPLE_SUSPICIOUS_CHARS',
          count: suspiciousChars,
          severity: 'medium'
        });
      }

      // Check for encoded injection attempts
      const encodedPatterns = [
        /%[0-9a-f]{2}/gi, // URL encoding
        /&#\d+;/gi, // HTML decimal encoding
        /&#x[0-9a-f]+;/gi // HTML hex encoding
      ];

      for (const pattern of encodedPatterns) {
        const matches = input.match(pattern);
        if (matches && matches.length > 3) {
          threats.push({
            type: 'ENCODED_INJECTION_ATTEMPT',
            encoding: pattern.toString(),
            count: matches.length,
            severity: 'high'
          });
        }
      }

      // Context-specific validation
      if (context.queryType) {
        const contextThreats = this.validateContext(input, context.queryType);
        threats.push(...contextThreats);
      }

      const isSafe = threats.length === 0;

      // Log security threats
      if (!isSafe) {
        logSecurityEvent(context, 'SQL_INJECTION_ATTEMPT', {
          field: fieldName,
          input: input.substring(0, 200), // Log first 200 chars
          threats: threats.map(t => ({ type: t.type, severity: t.severity })),
          threatCount: threats.length,
          severity: this.calculateThreatSeverity(threats)
        });
      }

      return {
        safe: isSafe,
        threats,
        severity: this.calculateThreatSeverity(threats),
        riskScore: this.calculateRiskScore(threats)
      };

    } catch (error) {
      console.error('💥 SQL injection scan error:', error.message);
      
      // Log the error but err on the side of caution
      logSecurityEvent(context, 'SQL_SCAN_ERROR', {
        field: fieldName,
        error: error.message,
        severity: 'medium'
      });

      return {
        safe: false,
        threats: [{ type: 'SCAN_ERROR', severity: 'medium' }],
        error: error.message
      };
    }
  }

  /**
   * Validate input based on specific SQL context
   * @param {string} input - Input to validate
   * @param {string} queryType - Type of SQL query context
   * @returns {Array} - Array of threats found
   */
  validateContext(input, queryType) {
    const threats = [];
    const patterns = this.contextPatterns[queryType];

    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          threats.push({
            type: `CONTEXT_VIOLATION_${queryType.toUpperCase()}`,
            pattern: pattern.toString(),
            severity: 'high',
            context: queryType
          });
        }
      }
    }

    return threats;
  }

  /**
   * Calculate overall threat severity
   * @param {Array} threats - Array of detected threats
   * @returns {string} - Overall severity level
   */
  calculateThreatSeverity(threats) {
    if (threats.length === 0) return 'none';

    const severities = threats.map(t => t.severity);
    
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Calculate numerical risk score
   * @param {Array} threats - Array of detected threats
   * @returns {number} - Risk score (0-100)
   */
  calculateRiskScore(threats) {
    if (threats.length === 0) return 0;

    const severityScores = {
      'critical': 40,
      'high': 25,
      'medium': 15,
      'low': 5
    };

    let totalScore = 0;
    for (const threat of threats) {
      totalScore += severityScores[threat.severity] || 5;
    }

    // Cap at 100
    return Math.min(100, totalScore);
  }

  /**
   * Sanitize input by removing/escaping dangerous patterns
   * @param {string} input - Input to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} - Sanitized input
   */
  sanitizeInput(input, options = {}) {
    try {
      if (!input || typeof input !== 'string') {
        return '';
      }

      let sanitized = input;

      if (options.removeComments !== false) {
        // Remove SQL comments
        sanitized = sanitized.replace(/--.*$/gm, '');
        sanitized = sanitized.replace(/\/\*.*?\*\//gs, '');
        sanitized = sanitized.replace(/#.*$/gm, '');
      }

      if (options.removeSemicolons !== false) {
        // Remove semicolons (prevent stacked queries)
        sanitized = sanitized.replace(/;/g, '');
      }

      if (options.escapeQuotes !== false) {
        // Escape quotes
        sanitized = sanitized.replace(/'/g, "''");
        sanitized = sanitized.replace(/"/g, '""');
      }

      if (options.removeUnions !== false) {
        // Remove UNION statements
        sanitized = sanitized.replace(/\bUNION\b/gi, '');
      }

      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();

      return sanitized;

    } catch (error) {
      console.error('💥 SQL sanitization error:', error.message);
      return ''; // Return empty string on error
    }
  }

  /**
   * Validate parameterized query parameters
   * @param {Array} params - Query parameters
   * @param {Object} context - Context information
   * @returns {Object} - Validation results
   */
  validateParameters(params, context = {}) {
    try {
      const results = {
        safe: true,
        validatedParams: [],
        threats: []
      };

      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        
        if (typeof param === 'string') {
          const scanResult = this.scanForSQLInjection(param, context, `param_${i}`);
          
          if (!scanResult.safe) {
            results.safe = false;
            results.threats.push(...scanResult.threats);
          }

          // Sanitize the parameter
          results.validatedParams.push(this.sanitizeInput(param));
        } else {
          // Non-string parameters are generally safe
          results.validatedParams.push(param);
        }
      }

      return results;

    } catch (error) {
      console.error('💥 Parameter validation error:', error.message);
      return {
        safe: false,
        validatedParams: [],
        threats: [{ type: 'VALIDATION_ERROR', severity: 'medium' }],
        error: error.message
      };
    }
  }

  /**
   * Create a secure SQL query with validated parameters
   * @param {string} query - SQL query template with placeholders
   * @param {Array} params - Parameters to bind
   * @param {Object} context - Context information
   * @returns {Object} - Secure query object
   */
  createSecureQuery(query, params = [], context = {}) {
    try {
      // Validate the query template itself
      const queryValidation = this.scanForSQLInjection(query, context, 'query_template');
      
      if (!queryValidation.safe) {
        throw new Error('Unsafe query template detected');
      }

      // Validate parameters
      const paramValidation = this.validateParameters(params, context);
      
      if (!paramValidation.safe) {
        throw new Error('Unsafe parameters detected');
      }

      return {
        safe: true,
        query: query,
        params: paramValidation.validatedParams,
        validation: {
          queryThreats: queryValidation.threats,
          paramThreats: paramValidation.threats
        }
      };

    } catch (error) {
      console.error('💥 Secure query creation error:', error.message);
      
      logSecurityEvent(context, 'SECURE_QUERY_CREATION_FAILED', {
        error: error.message,
        query: query.substring(0, 100),
        paramCount: params.length,
        severity: 'high'
      });

      return {
        safe: false,
        error: error.message,
        query: null,
        params: null
      };
    }
  }
}

// Create singleton instance
const sqlInjectionProtection = new SQLInjectionProtection();

module.exports = {
  scanForSQLInjection: (input, context, fieldName) => 
    sqlInjectionProtection.scanForSQLInjection(input, context, fieldName),
  
  sanitizeInput: (input, options) => 
    sqlInjectionProtection.sanitizeInput(input, options),
  
  validateParameters: (params, context) => 
    sqlInjectionProtection.validateParameters(params, context),
  
  createSecureQuery: (query, params, context) => 
    sqlInjectionProtection.createSecureQuery(query, params, context),
  
  // Export the class for advanced usage
  SQLInjectionProtection
};