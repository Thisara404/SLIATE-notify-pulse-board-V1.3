// XSS Protection - Advanced Cross-Site Scripting protection
const { logSecurityEvent } = require('../middleware/logging');

class XSSProtection {
  constructor() {
    // XSS attack patterns
    this.xssPatterns = [
      // Script tags
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<script[^>]*>/gi,
      
      // Event handlers
      /\bon\w+\s*=\s*["']?[^"']*["']?/gi,
      /\bon(click|load|error|focus|blur|change|submit|reset|select|resize|scroll|mouseover|mouseout|keydown|keyup|keypress)\s*=/gi,
      
      // JavaScript URLs
      /javascript\s*:/gi,
      /vbscript\s*:/gi,
      /data\s*:/gi,
      
      // HTML tags that can execute code
      /<(iframe|frame|object|embed|applet|meta|link|style|base|form|input|img|svg|math|foreignObject)\b[^>]*>/gi,
      
      // Expression() attacks (IE)
      /expression\s*\([^)]*\)/gi,
      
      // Import statements
      /@import\s+/gi,
      
      // Encoded scripts
      /&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;/gi, // javascript
      /&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;/gi, // javascript
      
      // HTML5 attack vectors
      /<(video|audio|source|track|canvas|svg|math|details|summary)\b[^>]*>/gi,
      
      // CSS-based attacks
      /style\s*=\s*["'][^"']*expression\s*\(/gi,
      /style\s*=\s*["'][^"']*javascript\s*:/gi,
      
      // Data attributes that could be dangerous
      /data-[^=]*=\s*["'][^"']*javascript\s*:/gi,
      
      // Attribute-based injections
      /\w+\s*=\s*["']?[^"']*javascript\s*:/gi,
      
      // Protocol handlers
      /vbscript\s*:/gi,
      /livescript\s*:/gi,
      /mocha\s*:/gi,
      
      // CDATA sections
      /<!\[CDATA\[[\s\S]*?\]\]>/gi,
      
      // XML namespace attacks
      /xmlns\s*:\s*xss/gi,
      
      // HTML comments that could hide code
      /<!--[\s\S]*?-->/g,
      
      // Base64 encoded scripts
      /data:text\/html;base64,/gi,
      
      // URL-encoded attack patterns
      /%3C%73%63%72%69%70%74/gi, // <script
      /%3E/gi, // >
      
      // Double-encoded patterns
      /%253C%2573%2563%2572%2569%2570%2574/gi,
      
      // Unicode-based attacks
      /\u003C\u0073\u0063\u0072\u0069\u0070\u0074/gi,
      
      // CSS injection patterns
      /url\s*\(\s*["']?javascript\s*:/gi,
      /url\s*\(\s*["']?data\s*:/gi,
      
      // AngularJS template injection
      /\{\{[\s\S]*?\}\}/g,
      
      // Server-side template injection patterns
      /\$\{[\s\S]*?\}/g,
      /<%[\s\S]*?%>/g,
      /\{%[\s\S]*?%\}/g,
      
      // Polyglot attacks
      /javascript\s*:.*\balert\s*\(/gi,
      /javascript\s*:.*\bconfirm\s*\(/gi,
      /javascript\s*:.*\bprompt\s*\(/gi
    ];

    // Dangerous HTML tags that should be stripped
    this.dangerousTags = [
      'script', 'object', 'embed', 'applet', 'meta', 'iframe', 'frame',
      'frameset', 'link', 'style', 'base', 'form', 'input', 'button',
      'textarea', 'select', 'option', 'optgroup', 'fieldset', 'legend',
      'bgsound', 'sound', 'xml', 'import', 'layer', 'ilayer', 'nolayer'
    ];

    // Dangerous attributes that should be removed
    this.dangerousAttributes = [
      'onabort', 'onactivate', 'onafterprint', 'onafterupdate', 'onbeforeactivate',
      'onbeforecopy', 'onbeforecut', 'onbeforedeactivate', 'onbeforeeditfocus',
      'onbeforepaste', 'onbeforeprint', 'onbeforeunload', 'onbeforeupdate',
      'onblur', 'onbounce', 'oncellchange', 'onchange', 'onclick', 'oncontextmenu',
      'oncontrolselect', 'oncopy', 'oncut', 'ondataavailable', 'ondatasetchanged',
      'ondatasetcomplete', 'ondblclick', 'ondeactivate', 'ondrag', 'ondragend',
      'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop',
      'onerror', 'onerrorupdate', 'onfilterchange', 'onfinish', 'onfocus',
      'onfocusin', 'onfocusout', 'onhelp', 'onkeydown', 'onkeypress', 'onkeyup',
      'onlayoutcomplete', 'onload', 'onlosecapture', 'onmousedown', 'onmouseenter',
      'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup',
      'onmousewheel', 'onmove', 'onmoveend', 'onmovestart', 'onpaste',
      'onpropertychange', 'onreadystatechange', 'onreset', 'onresize',
      'onresizeend', 'onresizestart', 'onrowenter', 'onrowexit', 'onrowsdelete',
      'onrowsinserted', 'onscroll', 'onselect', 'onselectionchange',
      'onselectstart', 'onstart', 'onstop', 'onsubmit', 'onunload'
    ];

    // Context-specific patterns
    this.contextPatterns = {
      // Patterns dangerous in HTML content
      htmlContent: [
        /<script[\s\S]*?<\/script>/gi,
        /<style[\s\S]*?<\/style>/gi,
        /<[^>]*\son\w+\s*=/gi
      ],
      
      // Patterns dangerous in attributes
      attribute: [
        /javascript\s*:/gi,
        /vbscript\s*:/gi,
        /expression\s*\(/gi
      ],
      
      // Patterns dangerous in CSS
      css: [
        /expression\s*\(/gi,
        /javascript\s*:/gi,
        /vbscript\s*:/gi,
        /@import/gi,
        /url\s*\(\s*["']?javascript/gi
      ]
    };

    // HTML entities for encoding
    this.htmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
  }

  /**
   * Scan input for XSS attack patterns
   * @param {string} input - User input to scan
   * @param {Object} context - Context information
   * @param {string} fieldName - Name of the field being validated
   * @param {string} inputContext - Context of input (html, attribute, css)
   * @returns {Object} - Scan results
   */
  scanForXSS(input, context = {}, fieldName = 'unknown', inputContext = 'html') {
    try {
      if (!input || typeof input !== 'string') {
        return { safe: true, threats: [] };
      }

      const threats = [];

      // Check against XSS patterns
      for (let i = 0; i < this.xssPatterns.length; i++) {
        const pattern = this.xssPatterns[i];
        const matches = input.match(pattern);
        
        if (matches) {
          threats.push({
            type: 'XSS_PATTERN_MATCH',
            pattern: pattern.toString(),
            matches: matches.slice(0, 3), // Only show first 3 matches
            severity: 'high',
            context: inputContext
          });
        }
      }

      // Check for dangerous tags
      for (const tag of this.dangerousTags) {
        const tagPattern = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
        if (tagPattern.test(input)) {
          threats.push({
            type: 'DANGEROUS_HTML_TAG',
            tag: tag,
            severity: 'critical',
            context: inputContext
          });
        }
      }

      // Check for dangerous attributes
      for (const attr of this.dangerousAttributes) {
        const attrPattern = new RegExp(`\\b${attr}\\s*=`, 'gi');
        if (attrPattern.test(input)) {
          threats.push({
            type: 'DANGEROUS_ATTRIBUTE',
            attribute: attr,
            severity: 'high',
            context: inputContext
          });
        }
      }

      // Context-specific validation
      if (this.contextPatterns[inputContext]) {
        for (const pattern of this.contextPatterns[inputContext]) {
          if (pattern.test(input)) {
            threats.push({
              type: `CONTEXT_XSS_${inputContext.toUpperCase()}`,
              pattern: pattern.toString(),
              severity: 'high',
              context: inputContext
            });
          }
        }
      }

      // Check for encoded attacks
      const decodedInput = this.decodeInput(input);
      if (decodedInput !== input) {
        const decodedScan = this.scanForXSS(decodedInput, context, fieldName, inputContext);
        if (!decodedScan.safe) {
          threats.push({
            type: 'ENCODED_XSS_ATTACK',
            originalInput: input.substring(0, 100),
            decodedInput: decodedInput.substring(0, 100),
            severity: 'critical',
            context: inputContext
          });
          threats.push(...decodedScan.threats);
        }
      }

      const isSafe = threats.length === 0;

      // Log security threats
      if (!isSafe) {
        logSecurityEvent(context, 'XSS_ATTACK_ATTEMPT', {
          field: fieldName,
          inputContext: inputContext,
          input: input.substring(0, 200),
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
      console.error('💥 XSS scan error:', error.message);
      
      logSecurityEvent(context, 'XSS_SCAN_ERROR', {
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
   * Sanitize input by encoding HTML entities
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

      if (options.stripTags !== false) {
        // Remove dangerous HTML tags
        for (const tag of this.dangerousTags) {
          const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
          sanitized = sanitized.replace(tagPattern, '');
        }
      }

      if (options.stripAttributes !== false) {
        // Remove dangerous attributes
        for (const attr of this.dangerousAttributes) {
          const attrPattern = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
          sanitized = sanitized.replace(attrPattern, '');
        }
      }

      if (options.encodeEntities !== false) {
        // Encode HTML entities
        sanitized = this.encodeHTMLEntities(sanitized);
      }

      if (options.removeScripts !== false) {
        // Remove script content
        sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
        sanitized = sanitized.replace(/javascript\s*:/gi, '');
        sanitized = sanitized.replace(/vbscript\s*:/gi, '');
      }

      return sanitized;

    } catch (error) {
      console.error('💥 XSS sanitization error:', error.message);
      return ''; // Return empty string on error
    }
  }

  /**
   * Encode HTML entities
   * @param {string} input - Input to encode
   * @returns {string} - Encoded input
   */
  encodeHTMLEntities(input) {
    try {
      if (!input || typeof input !== 'string') {
        return '';
      }

      return input.replace(/[&<>"'`=\/]/g, (match) => {
        return this.htmlEntities[match] || match;
      });

    } catch (error) {
      console.error('💥 HTML encoding error:', error.message);
      return input;
    }
  }

  /**
   * Decode common encodings to detect hidden attacks
   * @param {string} input - Input to decode
   * @returns {string} - Decoded input
   */
  decodeInput(input) {
    try {
      let decoded = input;

      // URL decode
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        // Invalid URL encoding, continue
      }

      // HTML entity decode (basic)
      decoded = decoded.replace(/&lt;/gi, '<');
      decoded = decoded.replace(/&gt;/gi, '>');
      decoded = decoded.replace(/&quot;/gi, '"');
      decoded = decoded.replace(/&#x27;/gi, "'");
      decoded = decoded.replace(/&#x2F;/gi, '/');
      decoded = decoded.replace(/&#x60;/gi, '`');
      decoded = decoded.replace(/&#x3D;/gi, '=');
      decoded = decoded.replace(/&amp;/gi, '&');

      // Numeric HTML entities
      decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
        try {
          return String.fromCharCode(parseInt(num, 10));
        } catch (e) {
          return match;
        }
      });

      // Hex HTML entities
      decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch (e) {
          return match;
        }
      });

      return decoded;

    } catch (error) {
      console.error('💥 Input decoding error:', error.message);
      return input;
    }
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

    return Math.min(100, totalScore);
  }

  /**
   * Create safe HTML content from user input
   * @param {string} input - User input
   * @param {Object} options - Safety options
   * @returns {string} - Safe HTML content
   */
  createSafeHTML(input, options = {}) {
    try {
      if (!input || typeof input !== 'string') {
        return '';
      }

      const allowedTags = options.allowedTags || ['p', 'br', 'b', 'i', 'u', 'strong', 'em'];
      const allowedAttributes = options.allowedAttributes || [];

      let safe = input;

      // Remove all tags except allowed ones
      const allTagsPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      safe = safe.replace(allTagsPattern, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
          // Keep allowed tags but strip attributes unless specifically allowed
          if (allowedAttributes.length > 0) {
            // This is a simplified implementation - you might want to use a proper HTML parser
            return `<${tagName}>`;
          }
          return match;
        }
        return ''; // Remove disallowed tags
      });

      // Encode remaining content
      safe = this.encodeHTMLEntities(safe);

      return safe;

    } catch (error) {
      console.error('💥 Safe HTML creation error:', error.message);
      return this.encodeHTMLEntities(input);
    }
  }
}

// Create singleton instance
const xssProtection = new XSSProtection();

module.exports = {
  scanForXSS: (input, context, fieldName, inputContext) => 
    xssProtection.scanForXSS(input, context, fieldName, inputContext),
  
  sanitizeInput: (input, options) => 
    xssProtection.sanitizeInput(input, options),
  
  encodeHTMLEntities: (input) => 
    xssProtection.encodeHTMLEntities(input),
  
  createSafeHTML: (input, options) => 
    xssProtection.createSafeHTML(input, options),
  
  // Export the class for advanced usage
  XSSProtection
};