// Environment Setup Script for SLIATE Notice System
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up SLIATE Notice System environment...');

// Create required directories
const directories = [
  'logs',
  'uploads',
  'uploads/thumbnails',
  'tmp'
];

directories.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Create .env file if it doesn't exist
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  const envTemplate = `# SLIATE Notice System Environment Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration (use your existing database)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_existing_database_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_PATH=uploads
MAX_FILE_SIZE=10485760
MAX_IMAGE_SIZE=5242880

# Security Configuration
LOG_LEVEL=INFO
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
`;

  fs.writeFileSync(envPath, envTemplate);
  console.log('📄 Created .env template file');
  console.log('⚠️  Please update the .env file with your actual configuration values');
}

console.log('✅ Environment setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Update the .env file with your database and security configurations');
console.log('2. Use your existing database migration in server/database/migrate.js');
console.log('3. Run: npm run dev (to start development server)');
console.log('4. Run: npm test (to run the test suite)');