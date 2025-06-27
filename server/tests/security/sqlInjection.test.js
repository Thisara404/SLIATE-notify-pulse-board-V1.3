// SQL Injection Security Tests - Comprehensive testing for SQL injection vulnerabilities
const { scanForSQLInjection, sanitizeInput, createSecureQuery } = require('../../src/utils/sqlInjectionProtection');

describe('🔒 SQL Injection Protection Tests', () => {
  describe('Basic SQL Injection Detection', () => {
    test('should detect basic SQL injection patterns', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "1; DELETE FROM notices; --",
        "' OR 1=1 --",
        "admin' OR 'a'='a",
        "'; INSERT INTO users VALUES('hacker','password'); --"
      ];

      maliciousInputs.forEach(input => {
        const result = scanForSQLInjection(input, { ip: '127.0.0.1' }, 'test_field');
        
        expect(result.safe).toBe(false);
        expect(result.threats).toHaveLength(expect.any(Number));
        expect(result.threats.length).toBeGreaterThan(0);
        expect(result.severity).toMatch(/^(critical|high|medium)$/);
      });
    });

    test('should allow safe input', () => {
      const safeInputs = [
        'john_doe',
        'user@example.com',
        'Normal text content',
        'Product Name 123',
        'File-name_with-dashes.txt',
        'Valid search query'
      ];

      safeInputs.forEach(input => {
        const result = scanForSQLInjection(input, { ip: '127.0.0.1' }, 'test_field');
        
        expect(result.safe).toBe(true);
        expect(result.threats).toHaveLength(0);
        expect(result.severity).toBe('none');
      });
    });

    test('should detect advanced SQL injection techniques', () => {
      const advancedAttacks = [
        // Union-based injection
        "' UNION ALL SELECT NULL,NULL,NULL,NULL,username,password FROM users WHERE '1'='1",
        // Boolean-based blind injection
        "' AND (SELECT COUNT(*) FROM users WHERE username='admin')>0 --",
        // Time-based injection
        "'; WAITFOR DELAY '00:00:05' --",
        "' OR SLEEP(5) --",
        // Stacked queries
        "'; EXEC xp_cmdshell('net user hacker password /add') --",
        // Comment variations
        "admin'/**/OR/**/1=1#",
        // Encoded injection
        "%27%20OR%201=1%20--",
        // Nested queries
        "' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --"
      ];

      advancedAttacks.forEach(attack => {
        const result = scanForSQLInjection(attack, { ip: '127.0.0.1' }, 'advanced_test');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          ['SQL_INJECTION_PATTERN', 'DANGEROUS_SQL_KEYWORD'].includes(threat.type)
        )).toBe(true);
        expect(result.riskScore).toBeGreaterThan(50);
      });
    });
  });

  describe('Context-Aware Validation', () => {
    test('should validate WHERE clause context', () => {
      const whereClauseAttacks = [
        "1=1 OR 1=1",
        "user OR 'admin'='admin'",
        "id UNION SELECT password FROM users"
      ];

      whereClauseAttacks.forEach(attack => {
        const result = scanForSQLInjection(attack, { queryType: 'whereClause' }, 'where_test');
        
        expect(result.safe).toBe(false);
        expect(result.threats.some(threat => 
          threat.type === 'CONTEXT_VIOLATION_WHERECLAUSE'
        )).toBe(true);
      });
    });

    test('should validate ORDER BY clause context', () => {
      const orderByAttacks = [
        "1 UNION SELECT username FROM users",
        "(SELECT username FROM users LIMIT 1)",
        "id; DROP TABLE users"
      ];

      orderByAttacks.forEach(attack => {
        const result = scanForSQLInjection(attack, { queryType: 'orderBy' }, 'orderby_test');
        
        expect(result.safe).toBe(false);
      });
    });

    test('should validate LIMIT clause context', () => {
      const limitAttacks = [
        "10; DROP TABLE users",
        "1 UNION SELECT * FROM users",
        "5, (SELECT COUNT(*) FROM users)"
      ];

      limitAttacks.forEach(attack => {
        const result = scanForSQLInjection(attack, { queryType: 'limit' }, 'limit_test');
        
        expect(result.safe).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize dangerous SQL patterns', () => {
      const dangerousInputs = [
        { input: "admin'; DROP TABLE users; --", expected: "admin" },
        { input: "user/* comment */name", expected: "username" },
        { input: "test'OR'1'='1", expected: "test''OR''1''=''1" },
        { input: "value; SELECT * FROM users", expected: "value SELECT * FROM users" },
        { input: "name--comment", expected: "name" }
      ];

      dangerousInputs.forEach(({ input, expected }) => {
        const sanitized = sanitizeInput(input);
        
        expect(sanitized).not.toContain('DROP');
        expect(sanitized).not.toContain('--');
        expect(sanitized).not.toContain('/*');
        expect(sanitized).not.toContain(';');
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });

    test('should preserve safe content during sanitization', () => {
      const safeInputs = [
        'normal_username',
        'email@domain.com',
        'Product Name 123',
        'Safe text content'
      ];

      safeInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).toBe(input);
      });
    });

    test('should handle edge cases in sanitization', () => {
      const edgeCases = [
        { input: '', expected: '' },
        { input: null, expected: '' },
        { input: undefined, expected: '' },
        { input: 123, expected: '123' },
        { input: '   ', expected: '' }
      ];

      edgeCases.forEach(({ input, expected }) => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).toBe(expected);
      });
    });
  });

  describe('Parameter Validation', () => {
    test('should validate query parameters for safety', () => {
      const testCases = [
        {
          params: ['john', 'password123', 'user@example.com'],
          shouldPass: true
        },
        {
          params: ['admin', "'; DROP TABLE users; --", 'email'],
          shouldPass: false
        },
        {
          params: ['user', 'pass', "' OR 1=1 --"],
          shouldPass: false
        },
        {
          params: [123, 'safe_string', new Date()],
          shouldPass: true
        }
      ];

      testCases.forEach(({ params, shouldPass }) => {
        const { validateParameters } = require('../../src/utils/sqlInjectionProtection');
        const result = validateParameters(params, { ip: '127.0.0.1' });
        
        expect(result.safe).toBe(shouldPass);
        if (!shouldPass) {
          expect(result.threats.length).toBeGreaterThan(0);
        }
      });
    });

    test('should create secure parameterized queries', () => {
      const query = 'SELECT * FROM users WHERE username = ? AND email = ?';
      const params = ['testuser', 'test@example.com'];
      
      const result = createSecureQuery(query, params, { ip: '127.0.0.1' });
      
      expect(result.safe).toBe(true);
      expect(result.query).toBe(query);
      expect(result.params).toEqual(params);
    });

    test('should reject unsafe query templates', () => {
      const unsafeQueries = [
        "SELECT * FROM users WHERE id = 1; DROP TABLE users; --",
        "SELECT * FROM users WHERE 1=1 OR 1=1",
        "SELECT * FROM users UNION SELECT * FROM admin_users"
      ];

      unsafeQueries.forEach(query => {
        const result = createSecureQuery(query, [], { ip: '127.0.0.1' });
        
        expect(result.safe).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Risk Assessment', () => {
    test('should calculate accurate risk scores', () => {
      const testCases = [
        {
          input: "'; DROP TABLE users; DELETE FROM notices; --",
          expectedMinScore: 80
        },
        {
          input: "admin' OR '1'='1",
          expectedMinScore: 50
        },
        {
          input: "user123",
          expectedMaxScore: 0
        },
        {
          input: "test'quote",
          expectedMaxScore: 30
        }
      ];

      testCases.forEach(({ input, expectedMinScore, expectedMaxScore }) => {
        const result = scanForSQLInjection(input, { ip: '127.0.0.1' }, 'risk_test');
        
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
          input: "'; EXEC xp_cmdshell('format c:'); --",
          expectedSeverity: 'critical'
        },
        {
          input: "admin' OR 1=1 --",
          expectedSeverity: 'high'
        },
        {
          input: "test'quote in text",
          expectedSeverity: /^(medium|low|none)$/
        }
      ];

      severityTests.forEach(({ input, expectedSeverity }) => {
        const result = scanForSQLInjection(input, { ip: '127.0.0.1' }, 'severity_test');
        
        if (typeof expectedSeverity === 'string') {
          expect(result.severity).toBe(expectedSeverity);
        } else {
          expect(result.severity).toMatch(expectedSeverity);
        }
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle large input efficiently', () => {
      const largeInput = 'a'.repeat(10000) + "'; DROP TABLE users; --";
      
      const startTime = Date.now();
      const result = scanForSQLInjection(largeInput, { ip: '127.0.0.1' }, 'performance_test');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.safe).toBe(false);
    });

    test('should handle multiple concurrent scans', async () => {
      const inputs = [
        "'; DROP TABLE users; --",
        "admin' OR 1=1 --",
        "safe input",
        "another'; malicious input --",
        "normal text"
      ];

      const promises = inputs.map(input => 
        Promise.resolve(scanForSQLInjection(input, { ip: '127.0.0.1' }, 'concurrent_test'))
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
    test('should handle null and undefined inputs gracefully', () => {
      const invalidInputs = [null, undefined, {}, [], 123];

      invalidInputs.forEach(input => {
        const result = scanForSQLInjection(input, { ip: '127.0.0.1' }, 'error_test');
        
        expect(result).toHaveProperty('safe');
        expect(result).toHaveProperty('threats');
        expect(Array.isArray(result.threats)).toBe(true);
      });
    });

    test('should handle malformed context gracefully', () => {
      const malformedContexts = [
        null,
        undefined,
        'string instead of object',
        { malformed: 'context' }
      ];

      malformedContexts.forEach(context => {
        const result = scanForSQLInjection("test input", context, 'context_error_test');
        
        expect(result).toHaveProperty('safe');
        expect(result).toHaveProperty('threats');
      });
    });
  });

  describe('Integration Tests', () => {
    test('should integrate with logging system', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      // Mock console.log to capture log output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const result = scanForSQLInjection(
        maliciousInput, 
        { ip: '192.168.1.100', userAgent: 'test-agent' }, 
        'integration_test'
      );
      
      expect(result.safe).toBe(false);
      
      consoleSpy.mockRestore();
    });

    test('should work with database-like parameter scenarios', () => {
      const databaseScenarios = [
        {
          query: 'SELECT * FROM users WHERE username = ?',
          params: ['admin'],
          safe: true
        },
        {
          query: 'SELECT * FROM users WHERE username = ?',
          params: ["admin'; DROP TABLE users; --"],
          safe: false
        },
        {
          query: 'INSERT INTO notices (title, content) VALUES (?, ?)',
          params: ['Safe Title', 'Safe content here'],
          safe: true
        },
        {
          query: 'UPDATE users SET email = ? WHERE id = ?',
          params: ["'; DELETE FROM users; --", 1],
          safe: false
        }
      ];

      databaseScenarios.forEach(({ query, params, safe }) => {
        const result = createSecureQuery(query, params, { ip: '127.0.0.1' });
        
        expect(result.safe).toBe(safe);
        if (safe) {
          expect(result.query).toBe(query);
          expect(result.params).toEqual(expect.any(Array));
        } else {
          expect(result.error).toBeDefined();
        }
      });
    });
  });

  describe('Real-World Attack Patterns', () => {
    test('should detect actual attack patterns from security logs', () => {
      const realWorldAttacks = [
        // Common injection patterns from actual attacks
        "1' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)",
        "admin'/**/UNION/**/ALL/**/SELECT/**/NULL,NULL,NULL,username,password/**/FROM/**/users#",
        "' OR 'x'='x",
        "'; DECLARE @q VARCHAR(8000) SELECT @q = 0x73656c65637420636f756e74282a292066726f6d207379732e74616273; EXEC(@q)--",
        "1' UNION SELECT @@version,@@datadir,@@hostname,@@basedir --",
        "' OR (SELECT COUNT(*) FROM users)>0 AND '1'='1",
        "admin' AND (SELECT SUBSTRING(@@version,1,1))='5' --"
      ];

      realWorldAttacks.forEach(attack => {
        const result = scanForSQLInjection(attack, { 
          ip: '10.0.0.1', 
          userAgent: 'sqlmap/1.0',
          requestPath: '/login'
        }, 'real_world_test');
        
        expect(result.safe).toBe(false);
        expect(result.riskScore).toBeGreaterThan(60);
        expect(result.severity).toMatch(/^(critical|high)$/);
      });
    });

    test('should handle obfuscated injection attempts', () => {
      const obfuscatedAttacks = [
        // URL encoded
        "%27%20OR%20%271%27%3D%271",
        // HTML encoded
        "&#x27; OR &#x31;&#x3D;&#x31; &#x2D;&#x2D;",
        // Unicode encoded
        "\u0027 OR \u0031=\u0031 --",
        // Double encoded
        "%2527%2520OR%2520%2527%25321%2527%253D%2527%25321",
        // Mixed encoding
        "admin%27/**/UNION/**/SELECT/**/%27%2B%28SELECT%20%40%40version%29%2B%27"
      ];

      obfuscatedAttacks.forEach(attack => {
        const result = scanForSQLInjection(attack, { ip: '127.0.0.1' }, 'obfuscated_test');
        
        // Should detect either the original pattern or the decoded version
        expect(result.safe).toBe(false);
        expect(result.threats.length).toBeGreaterThan(0);
      });
    });
  });
});