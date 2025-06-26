// SLIATE Notice System - Main Server Entry Point
// Created by J33WAKASUPUN on 2025-06-24 17:11:30 UTC

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

console.log('🚀 Starting SLIATE Notice System...');
console.log(`👤 Created by: J33WAKASUPUN`);
console.log(`📅 Started: ${new Date().toISOString()}`);

class SLIATENoticeServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 5000;
        this.host = process.env.HOST || 'localhost';
        this.environment = process.env.NODE_ENV || 'development';
    }

    async initializeApp() {
        console.log('⚙️ Initializing SLIATE Notice System...');
        this.app.set('trust proxy', 1);
        
        // Initialize database connection FIRST
        await this.initializeDatabase();
        
        this.setupSecurity();
        this.setupCoreMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        console.log('✅ Application initialized successfully');
    }

    async initializeDatabase() {
        try {
            console.log('🗄️ Initializing database connection...');
            const secureDatabase = require('./src/config/database');
            await secureDatabase.initialize();
            
            // Test database connection
            const testResult = await secureDatabase.executeQuery('SELECT 1 as test');
            console.log('✅ Database initialized and tested successfully');
            console.log('🏓 Database test result:', testResult.rows[0]);
            
        } catch (error) {
            console.error('💥 Database initialization failed:', error.message);
            console.error('📝 Error details:', error);
            console.error('❌ Server cannot start without database connection');
            process.exit(1);
        }
    }

    setupSecurity() {
        console.log('🔒 Setting up security middleware...');

        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                }
            }
        }));

        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS.split(','),  // Use environment variable
            credentials: true,
            optionsSuccessStatus: 200,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
    }

    setupCoreMiddleware() {
        console.log('⚙️ Setting up core middleware...');

        this.app.use(compression());
        this.app.use(morgan(this.environment === 'development' ? 'dev' : 'combined'));
        this.app.use(express.json({ limit: '10mb', strict: true }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Setup static file serving for uploads
        const uploadsPath = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsPath)) {
            // Serve all uploads with proper CORS headers
            this.app.use('/uploads', (req, res, next) => {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET');
                res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                next();
            }, express.static(uploadsPath, {
                maxAge: '1d',
                etag: true,
                lastModified: true
            }));
            
            console.log('📁 Static files served from uploads/');
        }
    }

    setupRoutes() {
        console.log('🛣️ Setting up routes with external route files...');

        // ===============================
        // CORE SYSTEM ROUTES (BUILT-IN)
        // ===============================

        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.3.0',
                uptime: Math.floor(process.uptime()),
                environment: this.environment,
                author: 'J33WAKASUPUN'
            });
        });

        this.app.get('/', (req, res) => {
            res.status(200).json({
                name: 'SLIATE Notice System',
                version: '1.3.0',
                description: 'Secure Notice Management Platform',
                author: 'J33WAKASUPUN',
                created: '2025-06-24T17:11:30Z',
                status: 'operational',
                endpoints: {
                    health: '/health',
                    api: '/api',
                    status: '/status'
                },
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/api', (req, res) => {
            res.status(200).json({
                message: 'SLIATE Notice System API v1.3.0',
                author: 'J33WAKASUPUN',
                version: '1.3.0',
                baseUrl: `${req.protocol}://${req.get('host')}`,
                documentation: {
                    auth: '/api/auth/*',
                    notices: '/api/notices/*',
                    public: '/api/public/*',
                    analytics: '/api/analytics/*',
                    upload: '/api/upload/*'
                },
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/status', (req, res) => {
            res.status(200).json({
                server: 'SLIATE Notice System',
                status: 'operational',
                version: '1.3.0',
                author: 'J33WAKASUPUN',
                timestamp: new Date().toISOString(),
                uptime: Math.floor(process.uptime()),
                environment: this.environment
            });
        });

        // ===============================
        // LOAD EXTERNAL ROUTE FILES
        // ===============================

        this.loadExternalRoutes();
    }

    loadExternalRoutes() {
        console.log('📁 Loading application routes with direct imports...');

        // Initialize logging system
        try {
            const { logApiAccess } = require('./src/middleware/logging');
            console.log('📊 Security logging system initialized');
        } catch (error) {
            console.warn('⚠️ Logging system initialization failed:', error.message);
        }

        // ========== CRITICAL ROUTES (MUST LOAD) ==========

        this.app.use('/api', require('./src/routes/testGA'));

        try {
            const authRoutes = require('./src/routes/auth');
            this.app.use('/api/auth', authRoutes);
            console.log('✅ Authentication routes loaded');
        } catch (error) {
            console.error('❌ Failed to load auth routes:', error.message);
            console.error('Full error:', error.stack);
            process.exit(1);
        }

        try {
            const noticeRoutes = require('./src/routes/notices');
            this.app.use('/api/notices', noticeRoutes);
            console.log('✅ Notice routes loaded');
        } catch (error) {
            console.error('❌ Failed to load notice routes:', error.message);
            console.error('Full error:', error.stack);
            process.exit(1);
        }

        try {
            const publicRoutes = require('./src/routes/public');
            this.app.use('/api/public', publicRoutes);
            console.log('✅ Public routes loaded');
        } catch (error) {
            console.error('❌ Failed to load public routes:', error.message);
            console.error('Full error:', error.stack);
            process.exit(1);
        }

        // ========== OPTIONAL ROUTES (WARN IF FAILED) ==========

        try {
            const analyticsRoutes = require('./src/routes/analytics');
            this.app.use('/api/analytics', analyticsRoutes);
            console.log('✅ Analytics routes loaded');
        } catch (error) {
            console.warn('⚠️ Analytics routes not loaded:', error.message);
        }

        try {
            const uploadRoutes = require('./src/routes/upload');
            this.app.use('/api/upload', uploadRoutes);
            console.log('✅ Upload routes loaded');
        } catch (error) {
            console.warn('⚠️ Upload routes not loaded:', error.message);
        }

        // ========== API VERSIONING ==========

        // Add V1 API versioning for loaded routes
        console.log('🔗 Adding V1 API versioning...');

        try {
            const authRoutes = require('./src/routes/auth');
            this.app.use('/api/v1/auth', authRoutes);
            console.log('🔗 V1 auth routes added');
        } catch (error) {
            console.warn('⚠️ V1 auth routes failed:', error.message);
        }

        try {
            const noticeRoutes = require('./src/routes/notices');
            this.app.use('/api/v1/notices', noticeRoutes);
            console.log('🔗 V1 notice routes added');
        } catch (error) {
            console.warn('⚠️ V1 notice routes failed:', error.message);
        }

        try {
            const publicRoutes = require('./src/routes/public');
            this.app.use('/api/v1/public', publicRoutes);
            console.log('🔗 V1 public routes added');
        } catch (error) {
            console.warn('⚠️ V1 public routes failed:', error.message);
        }

        try {
            const analyticsRoutes = require('./src/routes/analytics');
            this.app.use('/api/v1/analytics', analyticsRoutes);
            console.log('🔗 V1 analytics routes added');
        } catch (error) {
            console.warn('⚠️ V1 analytics routes failed:', error.message);
        }

        try {
            const uploadRoutes = require('./src/routes/upload');
            this.app.use('/api/v1/upload', uploadRoutes);
            console.log('🔗 V1 upload routes added');
        } catch (error) {
            console.warn('⚠️ V1 upload routes failed:', error.message);
        }

        console.log('📊 Route loading completed');
    }

    setupErrorHandling() {
        console.log('⚠️ Setting up error handling...');

        // 404 handler for unmatched routes
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Route not found',
                message: `${req.method} ${req.path} not found`,
                availableRoutes: {
                    core: ['/', '/health', '/api', '/status'],
                    auth: ['/api/auth/login', '/api/auth/profile'],
                    public: ['/api/public/notices', '/api/public/health']
                },
                timestamp: new Date().toISOString()
            });
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('💥 Server error:', error.message);

            res.status(error.status || 500).json({
                success: false,
                error: this.environment === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString(),
                path: req.path
            });
        });
    }

    setupGracefulShutdown() {
        const gracefulShutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
            if (this.server) {
                this.server.close(() => {
                    console.log('✅ Graceful shutdown completed');
                    process.exit(0);
                });
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
    }

    async start() {
        try {
            await this.initializeApp();
            this.setupGracefulShutdown();

            this.server = this.app.listen(this.port, this.host, () => {
                console.log('\n🎉 SLIATE Notice System Started Successfully!');
                console.log('═'.repeat(65));
                console.log(`📍 Server URL: http://${this.host}:${this.port}`);
                console.log(`🌍 Environment: ${this.environment}`);
                console.log(`👤 Created by: J33WAKASUPUN`);
                console.log(`🕒 Started: ${new Date().toISOString()}`);
                console.log('═'.repeat(65));
                console.log('\n📋 Available Endpoints:');
                console.log(`  🏠 GET  /health     - Health check`);
                console.log(`  📖 GET  /api        - API documentation`);
                console.log(`  🔐 POST /api/auth/login - User login`);
                console.log(`  👤 GET  /api/auth/profile - User profile`);
                console.log(`  📋 GET  /api/notices - Notices (with auth)`);
                console.log(`  🌐 GET  /api/public/notices - Public notices`);
                console.log('\n🔧 Route Structure:');
                console.log('  📁 External route files loaded from routes/');
                console.log('  🔗 API versioning: /api/* and /api/v1/*');
                console.log('  🛡️ Authentication and validation middleware active');
                console.log('\n🚀 Ready for production use!\n');
            });

            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`💥 Port ${this.port} is already in use`);
                } else {
                    console.error('💥 Server error:', error.message);
                }
                process.exit(1);
            });

        } catch (error) {
            console.error('💥 Failed to start server:', error.message);
            process.exit(1);
        }
    }
}

const server = new SLIATENoticeServer();

if (require.main === module) {
    server.start().catch(console.error);
}

module.exports = server;