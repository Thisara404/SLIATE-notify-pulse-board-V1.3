// FIXED - Database migration script for Simple Notice System (No Password Setup)
const fs = require('fs').promises;
const path = require('path');
const secureDatabase = require('../src/config/database');
const { config } = require('../src/config/environment');

class DatabaseMigrator {
  constructor() {
    this.schemaFile = path.join(__dirname, 'schema.sql');
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  // Run database migration
  async migrate() {
    try {
      console.log('🔄 Starting database migration...');
      console.log('📊 Database configuration:', {
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        database: config.database.database,
        hasPassword: config.database.password ? 'YES' : 'NO (localhost development)'
      });
      
      // Create database if it doesn't exist first
      await this.createDatabase();

      // Initialize database connection
      await secureDatabase.initialize();
      console.log('✅ Database connection established');

      // Run schema migration
      await this.runSchemaMigration();

      console.log('🎉 Database migration completed successfully!');
      
      // Test the setup
      await this.testDatabase();
      
    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      
      // Provide helpful error information
      if (error.message.includes('access denied')) {
        console.error('💡 Possible solutions for phpMyAdmin setup:');
        console.error('   1. Make sure XAMPP/WAMP/MAMP is running');
        console.error('   2. Check that MySQL service is started');
        console.error('   3. Verify phpMyAdmin is accessible at http://localhost/phpmyadmin');
        console.error('   4. Try creating the database manually in phpMyAdmin first');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('💡 Connection refused - is MySQL running?');
        console.error('   1. Start XAMPP/WAMP/MAMP');
        console.error('   2. Make sure MySQL service is green/running');
        console.error('   3. Check if port 3306 is free');
      }
      
      process.exit(1);
    }
  }

  // Create database if it doesn't exist
  async createDatabase() {
    try {
      console.log('🔄 Creating database if it doesn\'t exist...');
      
      // Import mysql2 directly for this operation
      const mysql = require('mysql2/promise');
      
      // Create connection without database specified
      let connection;
      try {
        connection = await mysql.createConnection({
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password, // This will be empty string
          charset: 'utf8mb4'
        });
        
        console.log('✅ Connected to MySQL server successfully');
        
        // Create database if it doesn't exist
        const createDbQuery = `CREATE DATABASE IF NOT EXISTS \`${config.database.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
        await connection.execute(createDbQuery);
        
        console.log(`✅ Database "${config.database.database}" is ready`);
        
      } catch (connectionError) {
        console.error('💥 Failed to connect to MySQL:', connectionError.message);
        
        if (connectionError.code === 'ECONNREFUSED') {
          console.error('');
          console.error('🚫 MySQL Connection Refused');
          console.error('💡 Make sure your local server is running:');
          console.error('   - XAMPP: Start Apache and MySQL');
          console.error('   - WAMP: Make sure both services are green');
          console.error('   - MAMP: Start servers');
          console.error('   - Standalone MySQL: Check if service is running');
        } else if (connectionError.code === 'ER_ACCESS_DENIED_ERROR') {
          console.error('');
          console.error('🚫 Access Denied');
          console.error('💡 For phpMyAdmin setup, try:');
          console.error('   1. Use username "root" with empty password');
          console.error('   2. Check phpMyAdmin config if you have different settings');
          console.error('   3. Make sure MySQL user "root" exists with localhost access');
        }
        
        throw connectionError;
      } finally {
        if (connection) {
          await connection.end();
        }
      }
    } catch (error) {
      console.error('💥 Database creation error:', error.message);
      throw error;
    }
  }

  // Run main schema migration
  async runSchemaMigration() {
    try {
      console.log('🔄 Running schema migration...');
      
      // Read schema file
      const schemaSQL = await fs.readFile(this.schemaFile, 'utf8');
      
      // Split into individual statements (improved parsing)
      const statements = this.parseSQLStatements(schemaSQL);
      
      console.log(`📋 Found ${statements.length} SQL statements to execute`);
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        if (statement.trim()) {
          try {
            // Show what we're executing
            let description = 'Unknown operation';
            if (statement.toUpperCase().includes('CREATE TABLE')) {
              const match = statement.match(/CREATE TABLE\s+(\w+)/i);
              description = `Creating table: ${match ? match[1] : 'unknown'}`;
            } else if (statement.toUpperCase().includes('INSERT INTO')) {
              const match = statement.match(/INSERT INTO\s+(\w+)/i);
              description = `Inserting data into: ${match ? match[1] : 'unknown'}`;
            } else if (statement.toUpperCase().includes('CREATE VIEW')) {
              const match = statement.match(/CREATE VIEW\s+(\w+)/i);
              description = `Creating view: ${match ? match[1] : 'unknown'}`;
            }
            
            console.log(`⚙️ ${i + 1}/${statements.length}: ${description}`);
            await secureDatabase.executeQuery(statement);
            console.log(`   ✅ Success`);
            
          } catch (error) {
            console.error(`   💥 Error: ${error.message}`);
            
            // Continue with next statement for some errors
            if (error.message.includes('already exists') || 
                error.message.includes('Duplicate') ||
                error.message.includes('Table') && error.message.includes('already exists')) {
              console.log('   ⚠️ Already exists, continuing...');
              continue;
            }
            
            throw error;
          }
        }
      }
      
      console.log('✅ Schema migration completed successfully');
    } catch (error) {
      console.error('💥 Schema migration error:', error.message);
      throw error;
    }
  }

  // Improved SQL statement parsing (same as before)
  parseSQLStatements(sql) {
    // Remove comments
    const cleanSQL = sql
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/^\s*#.*$/gm, ''); // Remove # comments
    
    // Split by semicolon, but be smarter about it
    const statements = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < cleanSQL.length; i++) {
      const char = cleanSQL[i];
      
      // Handle string literals
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && inString) {
        inString = false;
        stringChar = '';
      }
      
      // If we find a semicolon outside of strings
      if (char === ';' && !inString) {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
        }
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }
    
    // Add the last statement if it exists
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => stmt.length > 0);
  }

  // Test database setup
  async testDatabase() {
    try {
      console.log('🧪 Testing database setup...');
      
      // Test users table
      const usersResult = await secureDatabase.executeQuery('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Users table: ${usersResult.rows[0].count} records`);
      
      // Test notices table
      const noticesResult = await secureDatabase.executeQuery('SELECT COUNT(*) as count FROM notices');
      console.log(`📋 Notices table: ${noticesResult.rows[0].count} records`);
      
      // Test site_visits table
      const visitsResult = await secureDatabase.executeQuery('SELECT COUNT(*) as count FROM site_visits');
      console.log(`📊 Site visits table: ${visitsResult.rows[0].count} records`);
      
      // Test sessions table
      const sessionsResult = await secureDatabase.executeQuery('SELECT COUNT(*) as count FROM user_sessions');
      console.log(`🔐 User sessions table: ${sessionsResult.rows[0].count} records`);
      
      // Test sample data
      const sampleUsers = await secureDatabase.executeQuery('SELECT username, role FROM users LIMIT 3');
      console.log('👤 Sample users:');
      sampleUsers.rows.forEach(user => {
        console.log(`   - ${user.username} (${user.role})`);
      });
      
      const sampleNotices = await secureDatabase.executeQuery('SELECT title, status FROM notices LIMIT 3');
      console.log('📝 Sample notices:');
      sampleNotices.rows.forEach(notice => {
        console.log(`   - ${notice.title} (${notice.status})`);
      });
      
      console.log('✅ Database test completed successfully!');
      console.log('🎉 You can now access phpMyAdmin to see your tables!');
      
    } catch (error) {
      console.error('💥 Database test error:', error.message);
      throw error;
    }
  }

  // Status method
  async status() {
    try {
      console.log('📊 Database Status Report');
      console.log('========================');
      
      await secureDatabase.initialize();
      
      // Check tables
      const tablesResult = await secureDatabase.executeQuery('SHOW TABLES');
      console.log(`📋 Tables: ${tablesResult.rows.length}`);
      
      tablesResult.rows.forEach(row => {
        const tableName = Object.values(row)[0];
        console.log(`  ✅ ${tableName}`);
      });
      
      console.log('\n📈 Table Statistics:');
      await this.testDatabase();
      
    } catch (error) {
      console.error('💥 Status check error:', error.message);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  console.log('🚀 SLIATE-Notify Notice System - Database Migration');
  console.log('=============================================');
  
  const migrator = new DatabaseMigrator();
  const command = process.argv[2] || 'migrate';
  
  try {
    switch (command) {
      case 'migrate':
        await migrator.migrate();
        break;
      case 'status':
        await migrator.status();
        break;
      default:
        console.log('Usage: node database/migrate.js [migrate|status]');
        console.log('Commands:');
        console.log('  migrate - Run database migration');
        console.log('  status  - Show database status');
    }
  } finally {
    await secureDatabase.close();
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Migration script error:', error);
    process.exit(1);
  });
}

module.exports = DatabaseMigrator;