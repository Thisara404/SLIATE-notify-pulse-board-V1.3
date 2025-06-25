// Notice Routes - Complete CRUD operations for notices
const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { authenticate, authorize } = require('../middleware/auth');
// const { validateRequest, noticeValidationRules } = require('../middleware/validation'); // Temporarily commented out
const { logApiAccess } = require('../middleware/logging');
const upload = require('../middleware/upload');

// Middleware to log all notice route access
router.use((req, res, next) => {
  logApiAccess(req, `NOTICE_ROUTE_${req.method}_${req.path.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
  next();
});

// --- PUBLIC ROUTE ---
router.get('/slug/:slug', noticeController.getNoticeBySlug);

// All notice routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/notices
 * @desc    Get all notices with filtering and pagination
 * @access  Private (Admin)
 * @query   { page, limit, status, priority, search, createdBy, sortBy, sortOrder, includeStats }
 */
router.get('/',
  authorize(['admin', 'super_admin']),
  noticeController.getAllNotices
);

/**
 * @route   POST /api/notices
 * @desc    Create new notice
 * @access  Private (Admin)
 * @body    { title, description, imageUrl, files, priority, status }
 */
router.post('/',
  authorize(['admin', 'super_admin']),
  // noticeValidationRules.create, // Temporarily commented out
  // validateRequest,              // Temporarily commented out
  upload.mixedFields,
  noticeController.createNotice
);

/**
 * @route   GET /api/notices/search
 * @desc    Search notices
 * @access  Private (Admin)
 * @query   { q, page, limit, published_only }
 */
router.get('/search',
  authorize(['admin', 'super_admin']), 
  // noticeValidationRules.search, // Temporarily commented out
  // validateRequest,              // Temporarily commented out
  noticeController.searchNotices
);

/**
 * @route   GET /api/notices/:id
 * @desc    Get single notice by ID
 * @access  Private (Admin)
 * @param   id - Notice ID
 * @query   { includeStats }
 */
router.get('/:id',
  authorize(['admin', 'super_admin']),
  // noticeValidationRules.getById, // Temporarily commented out
  // validateRequest,               // Temporarily commented out
  noticeController.getNoticeById
);

/**
 * @route   PUT /api/notices/:id
 * @desc    Update notice
 * @access  Private (Admin - Owner or Super Admin)
 * @param   id - Notice ID
 * @body    { title, description, imageUrl, files, priority, status }
 */
router.put('/:id',
  authorize(['admin', 'super_admin']),
  // noticeValidationRules.update, // Temporarily commented out
  // validateRequest,              // Temporarily commented out
  upload.mixedFields,
  noticeController.updateNotice
);

/**
 * @route   DELETE /api/notices/:id
 * @desc    Delete notice
 * @access  Private (Admin - Owner or Super Admin)
 * @param   id - Notice ID
 */
router.delete('/:id',
  authorize(['admin', 'super_admin']),
  // noticeValidationRules.delete, // Temporarily commented out
  // validateRequest,              // Temporarily commented out
  noticeController.deleteNotice
);

/**
 * @route   POST /api/notices/:id/publish
 * @desc    Publish notice (change status to published)
 * @access  Private (Admin - Owner or Super Admin)
 * @param   id - Notice ID
 */
router.post('/:id/publish',
  authorize(['admin', 'super_admin']),
  // noticeValidationRules.publish, // Temporarily commented out
  // validateRequest,               // Temporarily commented out
  noticeController.publishNotice
);

/**
 * @route   POST /api/notices/:id/unpublish
 * @desc    Unpublish notice (change status to draft)
 * @access  Private (Admin - Owner or Super Admin)
 * @param   id - Notice ID
 */
router.post('/:id/unpublish',
  authorize(['admin', 'super_admin']), 
  // noticeValidationRules.unpublish, // Temporarily commented out
  // validateRequest,                // Temporarily commented out
  noticeController.unpublishNotice
);

/**
 * @route   GET /api/notices/:id/related
 * @desc    Get related notices
 * @access  Private (Admin)
 * @param   id - Notice ID
 * @query   { limit }
 */
router.get('/:id/related',
  authorize(['admin', 'super_admin']),
  // noticeValidationRules.getRelated, // Temporarily commented out
  // validateRequest,                  // Temporarily commented out
  noticeController.getRelatedNotices
);

/**
 * @route   GET /api/notices/:id/analytics
 * @desc    Get notice analytics
 * @access  Private (Admin - Owner or Super Admin)
 * @param   id - Notice ID
 * @query   { start_date, end_date, group_by }
 */
router.get('/:id/analytics',
  authorize(['admin', 'super_admin']), 
  // noticeValidationRules.getAnalytics, // Temporarily commented out
  // validateRequest,                    // Temporarily commented out
  noticeController.getNoticeAnalytics
);

module.exports = router;