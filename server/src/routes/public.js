// Public Routes - No authentication required, public-facing API
const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { validateJSON, sanitizeAll, public: publicValidationRules } = require('../middleware/validation');
const { logApiAccess } = require('../middleware/logging');

// Middleware to log all public route access
router.use((req, res, next) => {
  logApiAccess(req, `PUBLIC_ROUTE_${req.method}_${req.path.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
  next();
});

// Global middleware for this router
router.use(validateJSON);
router.use(sanitizeAll);

/**
 * @route   GET /api/public/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health',
  publicController.healthCheck
);

/**
 * @route   GET /api/public/site-info
 * @desc    Get site information and basic statistics
 * @access  Public
 */
router.get('/site-info',
  ...publicController.getSiteInfo // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/notices
 * @desc    Get published notices with pagination
 * @access  Public
 * @query   { page, limit, priority, search, sortBy, sortOrder }
 */
router.get('/notices',
  publicValidationRules.getNotices,
  ...publicController.getPublishedNotices // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/notices/latest
 * @desc    Get latest published notices
 * @access  Public
 * @query   { limit }
 */
router.get('/notices/latest',
  publicValidationRules.getLatest,
  ...publicController.getLatestNotices // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/notices/popular
 * @desc    Get popular notices (most viewed)
 * @access  Public
 * @query   { limit, days }
 */
router.get('/notices/popular',
  publicValidationRules.getPopular,
  ...publicController.getPopularNotices // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/notices/priority/:priority
 * @desc    Get notices by priority (high, medium, low)
 * @access  Public
 * @param   priority - Notice priority (high, medium, low)
 * @query   { page, limit }
 */
router.get('/notices/priority/:priority',
  publicValidationRules.getByPriority,
  ...publicController.getNoticesByPriority // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/notices/archive
 * @desc    Get notice archive (grouped by month/year)
 * @access  Public
 * @query   { year, month }
 */
router.get('/notices/archive',
  publicValidationRules.getArchive,
  ...publicController.getNoticeArchive // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/search
 * @desc    Search published notices
 * @access  Public
 * @query   { q, page, limit }
 */
router.get('/search',
  publicValidationRules.search,
  ...publicController.searchPublishedNotices // Use spread operator for rate-limited endpoints
);

/**
 * @route   GET /api/public/notices/:slug
 * @desc    Get published notice by slug
 * @access  Public
 * @param   slug - Notice slug
 * @query   { includeStats }
 */
router.get('/notices/:slug',
  publicValidationRules.getBySlug,
  ...publicController.getPublishedNoticeBySlug // Use spread operator for rate-limited endpoints
);

module.exports = router;