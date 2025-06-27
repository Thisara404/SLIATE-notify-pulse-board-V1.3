// Test Setup - Global test configuration and utilities
const { config } = require('../src/config/environment');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.LOG_LEVEL = 'ERROR'; // Reduce log noise in tests

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn, // Keep warnings
  error: console.error // Keep errors
};

// Global test utilities
global.testUtils = {
  // Generate random test data
  randomString: (length = 10) => {
    return Math.random().toString(36).substring(2, length + 2);
  },

  // Create test notice data
  createTestNotice: (overrides = {}) => {
    return {
      title: `Test Notice ${global.testUtils.randomString(6)}`,
      description: `Test notice description with detailed content for testing purposes. ${global.testUtils.randomString(20)}`,
      priority: 'medium',
      status: 'draft',
      ...overrides
    };
  },

  // Create test user data
  createTestUser: (overrides = {}) => {
    const id = global.testUtils.randomString(6);
    return {
      username: `testuser_${id}`,
      email: `test_${id}@example.com`,
      password: 'TestPass123!',
      fullName: `Test User ${id}`,
      role: 'admin',
      ...overrides
    };
  },

  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Clean test data (would connect to test database)
  cleanTestData: async () => {
    // In a real implementation, this would clean up test data
    console.log('🧹 Cleaning test data...');
  }
};

// Setup and teardown
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
  await global.testUtils.cleanTestData();
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});