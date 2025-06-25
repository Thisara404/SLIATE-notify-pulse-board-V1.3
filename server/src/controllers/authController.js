// Authentication Controller - Secure login, logout, and session management
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { config } = require('../config/environment');
const {
    logAuthentication,
    logSecurityEvent,
    logRateLimit
} = require('../middleware/logging');

class AuthController {
    constructor() {
        // Rate limiting for auth endpoints
        this.loginLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            message: {
                success: false,
                error: 'Too Many Login Attempts',
                message: 'Too many login attempts, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            onLimitReached: (req, res) => {
                logRateLimit(req, 'auth_login', {
                    windowMs: 15 * 60 * 1000,
                    max: 5,
                    exceeded: true
                });

                logSecurityEvent(req, 'RATE_LIMIT_EXCEEDED', {
                    endpoint: 'login',
                    severity: 'medium',
                    description: 'Login rate limit exceeded'
                });
            }
        });

        this.registerLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // 3 registrations per hour
            message: {
                success: false,
                error: 'Registration Rate Limit',
                message: 'Too many registration attempts, please try again later',
                retryAfter: '1 hour'
            },
            onLimitReached: (req, res) => {
                logRateLimit(req, 'auth_register', {
                    windowMs: 60 * 60 * 1000,
                    max: 3,
                    exceeded: true
                });
            }
        });
    }

    // User login
    login = async (req, res) => {
        try {
            const { username, password } = req.body;

            // Input validation
            if (!username || !password) {
                const result = { success: false, reason: 'Username and password are required' };
                logAuthentication(req, result);

                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Username and password are required',
                    timestamp: new Date().toISOString()
                });
            }

            // Sanitize inputs
            const cleanUsername = username.toString().trim().substring(0, 100);
            const cleanPassword = password.toString().substring(0, 128);

            console.log(`🔐 Login attempt for username: ${cleanUsername}`);

            // Authenticate user
            const authResult = await User.authenticate(cleanUsername, cleanPassword);

            if (!authResult.success) {
                console.log(`❌ Authentication failed: ${authResult.reason}`);
                logAuthentication(req, authResult);

                // Log potential brute force attempt
                if (authResult.reason === 'Invalid password') {
                    logSecurityEvent(req, 'FAILED_LOGIN_ATTEMPT', {
                        username: cleanUsername,
                        reason: authResult.reason,
                        severity: 'medium'
                    });
                }

                return res.status(401).json({
                    success: false,
                    error: 'Authentication Failed',
                    message: 'Invalid username or password',
                    timestamp: new Date().toISOString()
                });
            }

            const user = authResult.user;

            // Check if user object is valid
            if (!user || !user.id) {
                console.error('💥 Authentication succeeded but user object is invalid:', authResult);

                return res.status(500).json({
                    success: false,
                    error: 'Authentication Error',
                    message: 'User authentication data is invalid',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`✅ User authenticated: ${user.username} (ID: ${user.id})`);

            // Generate JWT token - FIXED: Use user.id instead of req.user.id
            const tokenPayload = {
                userId: user.id,        // ✅ Fixed!
                username: user.username,
                role: user.role,
                iat: Math.floor(Date.now() / 1000)
            };

            const token = jwt.sign(tokenPayload, config.jwt.secret, {
                expiresIn: config.jwt.expiresIn,
                algorithm: config.jwt.algorithm,
                issuer: config.jwt.issuer,
                audience: config.jwt.audience
            });

            console.log(`🔑 JWT token generated for user: ${user.username}`);

            // Create session record
            const sessionInfo = {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent']
            };

            try {
                const session = await UserSession.createSession(user.id, token, sessionInfo);
                console.log(`📝 Session created: ${session.id}`);

                // Log successful authentication
                logAuthentication(req, {
                    success: true,
                    reason: 'Valid credentials',
                    userId: user.id,
                    sessionId: session.id
                });

                console.log(`✅ Login successful for user: ${user.username} (${user.role})`);

                // Return success response
                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    data: {
                        token,
                        user: user.toJSON(),
                        session: {
                            id: session.id,
                            expiresAt: session.expiresAt
                        }
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (sessionError) {
                console.error('💥 Session creation failed:', sessionError.message);

                // Still return success since auth worked
                logAuthentication(req, {
                    success: true,
                    reason: 'Valid credentials, session creation failed',
                    userId: user.id,
                    sessionError: sessionError.message
                });

                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    data: {
                        token,
                        user: user.toJSON(),
                        session: {
                            id: null,
                            expiresAt: null
                        }
                    },
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('💥 Login error:', error.message);
            console.error('📝 Error stack:', error.stack);

            // Log the error
            const result = { success: false, reason: 'Server error during authentication' };
            logAuthentication(req, result);

            logSecurityEvent(req, 'AUTH_FAILURE', {
                reason: 'Server error during authentication',
                attemptedUsername: req.body?.username || 'unknown'
            });

            return res.status(500).json({
                success: false,
                error: 'Authentication Error',
                message: 'An error occurred during login',
                timestamp: new Date().toISOString()
            });
        }
    };

    // User registration (for admins to create other users)
    register = async (req, res) => {
        try {
            const { username, email, password, fullName, role } = req.body;

            // Check if user is authenticated and has permission
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to create users',
                    timestamp: new Date().toISOString()
                });
            }

            // Only super_admin can create other users
            if (!req.user.isSuperAdmin()) {
                logSecurityEvent(req, 'UNAUTHORIZED_USER_CREATION', {
                    attemptedBy: req.user.username,
                    attemptedRole: req.user.role,
                    severity: 'medium'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'Only super administrators can create new users',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate input data
            const userData = {
                username: username?.toString().trim(),
                email: email?.toString().trim(),
                password: password?.toString(),
                fullName: fullName?.toString().trim(),
                role: role || 'admin'
            };

            console.log(`👤 User creation attempt by ${req.user.username} for new user: ${userData.username}`);

            // Create user
            const newUser = await User.create(userData, req.user);

            console.log(`✅ User created successfully: ${newUser.username} (${newUser.role})`);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    user: newUser.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 User creation error:', error.message);

            // Handle specific errors
            let statusCode = 500;
            let message = 'An error occurred during user creation';

            if (error.message.includes('already exists')) {
                statusCode = 409;
                message = error.message;
            } else if (error.message.includes('Validation failed')) {
                statusCode = 400;
                message = error.message;
            }

            res.status(statusCode).json({
                success: false,
                error: 'User Creation Failed',
                message,
                timestamp: new Date().toISOString()
            });
        }
    };

    // User logout
    logout = async (req, res) => {
        try {
            // Get current session from token
            const authHeader = req.headers.authorization;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);

                try {
                    // Find and revoke the session
                    const session = await UserSession.findByToken(token);

                    if (session) {
                        await session.revoke(req.user);
                        console.log(`🔒 Session revoked for user: ${req.user?.username}`);
                    }
                } catch (sessionError) {
                    console.error('⚠️ Error revoking session:', sessionError.message);
                    // Continue with logout even if session revocation fails
                }
            }

            // Log the logout
            if (req.user) {
                logSecurityEvent(req, 'USER_LOGOUT', {
                    userId: req.user.id,
                    username: req.user.username,
                    severity: 'low'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Logout successful',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Logout error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Logout Error',
                message: 'An error occurred during logout',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get current user profile
    getProfile = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to view profile',
                    timestamp: new Date().toISOString()
                });
            }

            // Get fresh user data from database
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User Not Found',
                    message: 'User profile not found',
                    timestamp: new Date().toISOString()
                });
            }

            res.status(200).json({
                success: true,
                message: 'Profile retrieved successfully',
                data: {
                    user: user.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get profile error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Profile Error',
                message: 'An error occurred while retrieving profile',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Update user profile
    updateProfile = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to update profile',
                    timestamp: new Date().toISOString()
                });
            }

            const { fullName, email } = req.body;

            // Get current user
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User Not Found',
                    message: 'User profile not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Prepare update data
            const updateData = {};

            if (fullName && fullName.trim().length > 0) {
                updateData.fullName = fullName.trim();
            }

            if (email && email.trim().length > 0) {
                updateData.email = email.trim();
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'No valid fields provided for update',
                    timestamp: new Date().toISOString()
                });
            }

            // Update user
            await user.update(updateData, req.user);

            console.log(`👤 Profile updated for user: ${user.username}`);

            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: user.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Update profile error:', error.message);

            let statusCode = 500;
            let message = 'An error occurred while updating profile';

            if (error.message.includes('already exists')) {
                statusCode = 409;
                message = error.message;
            } else if (error.message.includes('validation')) {
                statusCode = 400;
                message = error.message;
            }

            res.status(statusCode).json({
                success: false,
                error: 'Profile Update Failed',
                message,
                timestamp: new Date().toISOString()
            });
        }
    };

    // Change password
    changePassword = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to change password',
                    timestamp: new Date().toISOString()
                });
            }

            const { currentPassword, newPassword, confirmPassword } = req.body;

            // Validate inputs
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Current password, new password, and confirmation are required',
                    timestamp: new Date().toISOString()
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'New password and confirmation do not match',
                    timestamp: new Date().toISOString()
                });
            }

            // Get current user
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User Not Found',
                    message: 'User not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Change password
            await user.changePassword(currentPassword, newPassword, req.user);

            console.log(`🔒 Password changed for user: ${user.username}`);

            // Revoke all other sessions for security
            await UserSession.revokeAllUserSessions(user.id, req.sessionId, req.user);

            res.status(200).json({
                success: true,
                message: 'Password changed successfully. Other sessions have been logged out.',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Change password error:', error.message);

            let statusCode = 500;
            let message = 'An error occurred while changing password';

            if (error.message.includes('Current password')) {
                statusCode = 401;
                message = error.message;
            } else if (error.message.includes('Password validation')) {
                statusCode = 400;
                message = error.message;
            }

            res.status(statusCode).json({
                success: false,
                error: 'Password Change Failed',
                message,
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get user sessions
    getSessions = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to view sessions',
                    timestamp: new Date().toISOString()
                });
            }

            // Get user sessions
            const sessions = await UserSession.getUserSessions(req.user.id);

            res.status(200).json({
                success: true,
                message: 'Sessions retrieved successfully',
                data: {
                    sessions: sessions.map(session => session.toJSON()),
                    count: sessions.length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get sessions error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Sessions Error',
                message: 'An error occurred while retrieving sessions',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Revoke specific session
    revokeSession = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to revoke sessions',
                    timestamp: new Date().toISOString()
                });
            }

            const { sessionId } = req.params;

            if (!sessionId || isNaN(parseInt(sessionId))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid session ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find the session
            const session = await UserSession.findById(parseInt(sessionId));

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session Not Found',
                    message: 'Session not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if user owns this session
            if (session.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'You can only revoke your own sessions',
                    timestamp: new Date().toISOString()
                });
            }

            // Revoke the session
            await session.revoke(req.user);

            res.status(200).json({
                success: true,
                message: 'Session revoked successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Revoke session error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Session Revocation Failed',
                message: 'An error occurred while revoking session',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Revoke all sessions except current
    revokeAllSessions = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to revoke sessions',
                    timestamp: new Date().toISOString()
                });
            }

            // Revoke all sessions except current
            const revokedCount = await UserSession.revokeAllUserSessions(
                req.user.id,
                req.sessionId,
                req.user
            );

            res.status(200).json({
                success: true,
                message: `${revokedCount} sessions revoked successfully`,
                data: {
                    revokedCount
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Revoke all sessions error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Session Revocation Failed',
                message: 'An error occurred while revoking sessions',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Token refresh (extend session)
    refreshToken = async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to refresh token',
                    timestamp: new Date().toISOString()
                });
            }

            // Generate new JWT token
            const tokenPayload = {
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                iat: Math.floor(Date.now() / 1000)
            };

            const newToken = jwt.sign(tokenPayload, config.jwt.secret, {
                expiresIn: config.jwt.expiresIn,
                algorithm: config.jwt.algorithm,
                issuer: config.jwt.issuer,
                audience: config.jwt.audience
            });

            console.log(`🔄 Token refreshed for user: ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    token: newToken,
                    user: req.user.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Token refresh error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Token Refresh Failed',
                message: 'An error occurred while refreshing token',
                timestamp: new Date().toISOString()
            });
        }
    };
}

// Create and export controller instance
const authController = new AuthController();

module.exports = {
    // Rate limited endpoints
    login: [authController.loginLimiter, authController.login],
    register: [authController.registerLimiter, authController.register],

    // Regular endpoints
    logout: authController.logout,
    getProfile: authController.getProfile,
    updateProfile: authController.updateProfile,
    changePassword: authController.changePassword,
    getSessions: authController.getSessions,
    revokeSession: authController.revokeSession,
    revokeAllSessions: authController.revokeAllSessions,
    refreshToken: authController.refreshToken
};
