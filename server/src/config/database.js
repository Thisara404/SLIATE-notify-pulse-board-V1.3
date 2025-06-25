// FIXED - Secure database configuration and connection pool
const mysql = require('mysql2/promise');
const { config, isDevelopment } = require('./environment');

class SecureDatabase {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 seconds
    }

    // Initialize secure database connection
    async initialize() {
        try {
            console.log('🔄 Initializing secure database connection...');
            console.log('📊 Database config:', {
                host: config.database.host,
                user: config.database.user,
                database: config.database.database,
                port: config.database.port || 3306,
                hasPassword: !!config.database.password
            });

            // Fixed configuration - remove invalid options for MySQL2
            this.pool = mysql.createPool({
                host: config.database.host,
                port: config.database.port || 3306,
                user: config.database.user,
                password: config.database.password || '', // Handle empty password
                database: config.database.database,

                // Character set for proper encoding
                charset: 'utf8mb4',
                timezone: 'Z',

                // Connection pool settings (FIXED - removed invalid options)
                connectionLimit: 20,
                queueLimit: 0,

                // Security configurations
                ssl: false, // Set to true for production with SSL
                multipleStatements: false, // Prevent SQL injection via multiple statements

                // Type casting for security
                typeCast: function (field, next) {
                    // Prevent type confusion attacks
                    if (field.type === 'TINY' && field.length === 1) {
                        return (field.string() === '1'); // Convert TINYINT(1) to boolean
                    }

                    // Prevent binary data issues
                    if (field.type === 'BLOB') {
                        return field.buffer();
                    }

                    return next();
                },

                // Debug logging in development
                debug: false // Disable debug to reduce noise
            });

            // Test the connection
            await this.testConnection();

            console.log('✅ Database connection established successfully');
            this.isConnected = true;

            // Set up connection event handlers
            this.setupEventHandlers();

            return this.pool;
        } catch (error) {
            console.error('💥 Database initialization failed:', error.message);
            await this.handleConnectionError(error);
            throw error;
        }
    }

    // Test database connection
    async testConnection() {
        try {
            console.log('🔄 Testing database connection...');
            const connection = await this.pool.getConnection();

            // Test basic query
            const [rows] = await connection.execute('SELECT 1 as test');
            console.log('🏓 Database ping successful, test result:', rows[0]);

            connection.release();
            return true;
        } catch (error) {
            console.error('💥 Database connection test failed:', error.message);

            // Provide helpful error messages
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                console.error('🚫 Access denied - Check your username and password');
                console.error('💡 Current config:', {
                    host: config.database.host,
                    user: config.database.user,
                    hasPassword: !!config.database.password,
                    passwordLength: config.database.password ? config.database.password.length : 0
                });
            } else if (error.code === 'ECONNREFUSED') {
                console.error('🚫 Connection refused - Is MySQL running?');
                console.error('💡 Check if MySQL service is running on port', config.database.port || 3306);
            } else if (error.code === 'ER_BAD_DB_ERROR') {
                console.error('🚫 Database does not exist:', config.database.database);
                console.error('💡 We will try to create it...');
            }

            throw error;
        }
    }

    // Setup connection event handlers
    setupEventHandlers() {
        this.pool.on('connection', (connection) => {
            console.log(`🔗 New database connection established as id ${connection.threadId}`);
        });

        this.pool.on('error', async (error) => {
            console.error('💥 Database pool error:', error.message);

            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                console.log('🔄 Attempting to reconnect to database...');
                await this.handleConnectionError(error);
            }
        });

        this.pool.on('release', (connection) => {
            if (isDevelopment()) {
                console.log(`🔓 Connection ${connection.threadId} released`);
            }
        });
    }

    // Handle connection errors with retry logic
    async handleConnectionError(error) {
        this.isConnected = false;
        this.connectionAttempts++;

        if (this.connectionAttempts <= this.maxRetries) {
            console.log(`🔄 Retrying database connection (${this.connectionAttempts}/${this.maxRetries})...`);

            await new Promise(resolve => setTimeout(resolve, this.retryDelay));

            try {
                await this.initialize();
                this.connectionAttempts = 0; // Reset on successful connection
            } catch (retryError) {
                console.error('💥 Retry failed:', retryError.message);

                if (this.connectionAttempts >= this.maxRetries) {
                    console.error('💥 Max connection retries exceeded. Database unavailable.');
                    process.exit(1);
                }
            }
        }
    }

    // Create database if it doesn't exist
    async createDatabaseIfNotExists() {
        try {
            console.log('🔄 Checking if database exists...');

            // Connect without specifying database
            const tempPool = mysql.createPool({
                host: config.database.host,
                port: config.database.port || 3306,
                user: config.database.user,
                password: config.database.password || '',
                charset: 'utf8mb4',
                timezone: 'Z'
            });

            // Create database if it doesn't exist
            const createDbQuery = `CREATE DATABASE IF NOT EXISTS \`${config.database.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
            await tempPool.execute(createDbQuery);

            console.log(`✅ Database "${config.database.database}" ready`);

            await tempPool.end();
            return true;
        } catch (error) {
            console.error('💥 Database creation error:', error.message);
            throw error;
        }
    }

    // Secure query execution with validation
    async executeQuery(query, params = []) {
        if (!this.isConnected || !this.pool) {
            throw new Error('Database not connected');
        }

        try {
            // Security validation
            this.validateQuery(query);
            this.validateParams(params);

            // Log query in development (without sensitive data)
            if (isDevelopment() && config.logging.enableSqlLogging) {
                console.log('🔍 Executing query:', {
                    query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                    paramCount: params.length,
                    timestamp: new Date().toISOString()
                });
            }

            const [rows, fields] = await this.pool.execute(query, params);

            return {
                rows,
                fields,
                affectedRows: rows.affectedRows,
                insertId: rows.insertId
            };
        } catch (error) {
            console.error('💥 Database query error:', {
                error: error.message,
                code: error.code,
                query: query.substring(0, 100),
                timestamp: new Date().toISOString()
            });

            // Re-throw with sanitized error message for security
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                throw new Error('Database access denied');
            } else if (error.code === 'ER_NO_SUCH_TABLE') {
                throw new Error('Database table not found');
            } else if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Duplicate entry found');
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                throw new Error('Invalid database field');
            } else {
                throw new Error('Database operation failed');
            }
        }
    }

    // Validate query for suspicious patterns
    validateQuery(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid query format');
        }

        // Check for suspicious patterns (but allow legitimate DDL for migrations)
        const suspiciousPatterns = [
            /;\s*(DROP|DELETE|TRUNCATE)\s+.*;\s*(DROP|DELETE|TRUNCATE)/i, // Multiple destructive operations
            /UNION\s+SELECT.*FROM.*information_schema/i, // Information schema attacks
            /INTO\s+OUTFILE/i,
            /LOAD_FILE\s*\(/i,
            /xp_cmdshell/i,
            /sp_executesql/i
        ];

        const containsSuspicious = suspiciousPatterns.some(pattern => pattern.test(query));

        if (containsSuspicious) {
            console.error('🚨 Suspicious query detected:', query.substring(0, 100));
            throw new Error('Potentially malicious query detected');
        }
    }

    // Validate query parameters
    validateParams(params) {
        if (!Array.isArray(params)) {
            throw new Error('Query parameters must be an array');
        }

        params.forEach((param, index) => {
            // ALLOW files JSON for Notice insert (index 3)
            if (index === 3) return;
            if (typeof param === 'string') {
                const suspiciousParamPatterns = [
                    /['";][\s\S]*?(OR|AND)[\s\S]*?['";]/i,
                    /UNION\s+SELECT/i,
                    /-{2,}/,
                    /\/\*/
                ];
                const containsSuspicious = suspiciousParamPatterns.some(pattern => pattern.test(param));
                if (containsSuspicious) {
                    console.error(`🚨 Suspicious parameter detected at index ${index}:`, param.substring(0, 50));
                    throw new Error('Potentially malicious parameter detected');
                }
            }
        });
    }

    // Transaction support
    async beginTransaction() {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();
        return connection;
    }

    async commitTransaction(connection) {
        await connection.commit();
        connection.release();
    }

    async rollbackTransaction(connection) {
        await connection.rollback();
        connection.release();
    }

    // Get connection pool status
    getPoolStatus() {
        if (!this.pool) {
            return { connected: false };
        }

        return {
            connected: this.isConnected,
            totalConnections: this.pool.pool._allConnections.length,
            freeConnections: this.pool.pool._freeConnections.length,
            queuedRequests: this.pool.pool._connectionQueue.length
        };
    }

    // Close database connection
    async close() {
        if (this.pool) {
            console.log('🔌 Closing database connection pool...');
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ Database connection closed');
        }
    }
}

// Create singleton instance
const secureDatabase = new SecureDatabase();

module.exports = secureDatabase;