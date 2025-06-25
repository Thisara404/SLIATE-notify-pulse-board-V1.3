// Upload Routes - Secure file upload and management
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');
// const { validateRequest, uploadValidationRules } = require('../middleware/validation'); // Temporarily commented out
const { logApiAccess } = require('../middleware/logging');

// Middleware to log all upload route access
router.use((req, res, next) => {
  logApiAccess(req, `UPLOAD_ROUTE_${req.method}_${req.path.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
  next();
});

// All upload routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin', 'super_admin']));

/**
 * @route   POST /api/upload/image
 * @desc    Upload single image file
 * @access  Private (Admin)
 * @body    FormData with 'image' field
 */
router.post('/image',
  // uploadValidationRules.image, // Temporarily commented out
  // validateRequest,             // Temporarily commented out
  uploadController.uploadImage
);

/**
 * @route   POST /api/upload/files
 * @desc    Upload multiple files
 * @access  Private (Admin)
 * @body    FormData with 'files' field (array)
 */
router.post('/files',
  // uploadValidationRules.files, // Temporarily commented out
  // validateRequest,             // Temporarily commented out
  uploadController.uploadFiles
);

/**
 * @route   GET /api/upload/list
 * @desc    Get list of uploaded files
 * @access  Private (Admin)
 * @query   { page, limit, type }
 */
router.get('/list',
  // uploadValidationRules.list, // Temporarily commented out
  // validateRequest,            // Temporarily commented out
  uploadController.getUploadedFiles
);

/**
 * @route   DELETE /api/upload/:filename
 * @desc    Delete uploaded file
 * @access  Private (Admin)
 * @param   filename - File name to delete
 */
router.delete('/:filename',
  // uploadValidationRules.delete, // Temporarily commented out
  // validateRequest,              // Temporarily commented out
  uploadController.deleteFile
);

module.exports = router;