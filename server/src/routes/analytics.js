// Analytics Routes - Comprehensive analytics and reporting
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateJSON, sanitizeAll, analytics: analyticsValidationRules } = require('../middleware/validation');
const { logApiAccess } = require('../middleware/logging');

// Middleware to log all analytics route access
router.use((req, res, next) => {
  logApiAccess(req, `ANALYTICS_ROUTE_${req.method}_${req.path.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
  next();
});

// Global middleware for this router
router.use(validateJSON);
router.use(sanitizeAll);

// All analytics routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard overview analytics
 * @access  Private (Admin)
 */
router.get('/dashboard',
  authorize(['admin', 'super_admin']),
  analyticsController.getDashboardAnalytics
);

/**
 * @route   GET /api/analytics/site
 * @desc    Get detailed site analytics
 * @access  Private (Admin)
 * @query   { start_date, end_date, group_by }
 */
router.get('/site',
  authorize(['admin', 'super_admin']),
  analyticsValidationRules.getSite,
  analyticsController.getSiteAnalytics
);

/**
 * @route   GET /api/analytics/content
 * @desc    Get content performance analytics
 * @access  Private (Admin)
 * @query   { limit }
 */
router.get('/content',
  authorize(['admin', 'super_admin']),
  analyticsValidationRules.getContent,
  analyticsController.getContentAnalytics
);

/**
 * @route   GET /api/analytics/users
 * @desc    Get user analytics and activity
 * @access  Private (Super Admin)
 */
router.get('/users',
  authorize(['super_admin']),
  analyticsController.getUserAnalytics
);

/**
 * @route   GET /api/analytics/security
 * @desc    Get security analytics and monitoring
 * @access  Private (Super Admin)
 */
router.get('/security',
  authorize(['super_admin']),
  analyticsController.getSecurityAnalytics
);

/**
 * @route   GET /api/analytics/notices/:id
 * @desc    Get specific notice analytics
 * @access  Private (Admin - Owner or Super Admin)
 * @param   id - Notice ID
 * @query   { start_date, end_date, group_by }
 */
router.get('/notices/:id',
  authorize(['admin', 'super_admin']),
  analyticsValidationRules.getNotice,
  analyticsController.getNoticeAnalytics
);

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data
 * @access  Private (Super Admin)
 * @query   { type, format, start_date, end_date }
 */
router.get('/export',
  authorize(['super_admin']),
  analyticsValidationRules.export,
  analyticsController.exportAnalytics
);

module.exports = router;