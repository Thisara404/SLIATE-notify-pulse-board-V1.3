// Authentication Routes - Secure user authentication and session management
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { logApiAccess } = require('../middleware/logging'); // ✅ Check this import

// Debug the import to see what we're getting
console.log('🔍 logApiAccess type:', typeof logApiAccess);
console.log('🔍 logApiAccess function:', logApiAccess);

// Middleware to log all auth route access
router.use((req, res, next) => {
  try {
    // Add safety check
    if (typeof logApiAccess === 'function') {
      logApiAccess(req, `AUTH_ROUTE_${req.method}_${req.path.replace('/', '_').toUpperCase()}`);
    } else {
      console.log('⚠️ logApiAccess is not a function, skipping logging');
    }
    next();
  } catch (error) {
    console.error('💥 Error in auth route logging:', error.message);
    next(); // Continue even if logging fails
  }
});

// Rest of your routes remain the same...
/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 * @body    { username, password }
 */
router.post('/login', 
  ...authController.login
);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (Super Admin only)
 * @access  Private (Super Admin)
 * @body    { username, email, password, fullName, role }
 */
router.post('/register',
  authenticate,
  authorize(['super_admin']),
  ...authController.register
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate session
 * @access  Private
 */
router.post('/logout',
  authenticate,
  authController.logout
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { fullName, email }
 */
router.put('/profile',
  authenticate,
  authController.updateProfile
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { currentPassword, newPassword, confirmPassword }
 */
router.post('/change-password',
  authenticate,
  authController.changePassword
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/sessions',
  authenticate,
  authController.getSessions
);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  authenticate,
  authController.revokeSession
);

/**
 * @route   DELETE /api/auth/sessions
 * @desc    Revoke all sessions except current
 * @access  Private
 */
router.delete('/sessions',
  authenticate,
  authController.revokeAllSessions
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh',
  authenticate,
  authController.refreshToken
);

module.exports = router;