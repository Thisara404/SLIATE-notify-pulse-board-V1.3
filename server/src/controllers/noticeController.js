// Notice Controller - Complete CRUD operations for notices
const Notice = require('../models/Notice');
const SiteVisit = require('../models/SiteVisit');
const {
    logDataModification,
    logSecurityEvent,
    logApiAccess
} = require('../middleware/logging');
const { config } = require('../config/environment');

class NoticeController {

    // Get all notices (admin view with filters)
    getAllNotices = async (req, res) => {
        try {
            logApiAccess(req, 'GET_ALL_NOTICES');

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to view notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Parse query parameters
            const {
                page = 1,
                limit = 10,
                status = null,
                priority = null,
                search = null,
                createdBy = null,
                sortBy = 'created_at',
                sortOrder = 'DESC',
                includeStats = false
            } = req.query;

            // Build options
            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                priority,
                search,
                createdBy: createdBy ? parseInt(createdBy) : null,
                sortBy,
                sortOrder: sortOrder.toUpperCase(),
                includeStats: includeStats === 'true'
            };

            console.log(`📋 Getting notices for ${req.user.username} with options:`, options);

            // Get notices
            const result = await Notice.getAll(options);

            res.status(200).json({
                success: true,
                message: 'Notices retrieved successfully',
                data: {
                    notices: result.notices.map(notice => notice.toJSON()),
                    pagination: result.pagination,
                    filters: {
                        status,
                        priority,
                        search,
                        createdBy
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get all notices error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get single notice by ID
    getNoticeById = async (req, res) => {
        try {
            const { id } = req.params;
            const { includeStats = false } = req.query;

            logApiAccess(req, 'GET_NOTICE_BY_ID', { noticeId: id });

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to view notice details',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id), includeStats === 'true');

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`📄 Notice retrieved: ${notice.title} by ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'Notice retrieved successfully',
                data: {
                    notice: notice.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get notice by ID error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving notice',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get notice by slug (public endpoint)
    getNoticeBySlug = async (req, res) => {
        try {
            const { slug } = req.params;
            const { includeStats = false } = req.query;

            logApiAccess(req, 'GET_NOTICE_BY_SLUG', { slug });

            // Validate slug
            if (!slug || typeof slug !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice slug is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findBySlug(slug, includeStats === 'true');

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if notice is published (for non-admin users)
            if (!notice.isPublished() && !req.user) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`📄 Notice retrieved by slug: ${notice.title}`);

            res.status(200).json({
                success: true,
                message: 'Notice retrieved successfully',
                data: {
                    notice: notice.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get notice by slug error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving notice',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Create new notice
    createNotice = async (req, res) => {
        try {
            logApiAccess(req, 'CREATE_NOTICE');

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to create notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions (only admins can create notices)
            if (!['admin', 'super_admin'].includes(req.user.role)) {
                logSecurityEvent(req, 'UNAUTHORIZED_NOTICE_CREATION', {
                    attemptedBy: req.user.username,
                    severity: 'medium'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'Only administrators can create notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Extract uploaded files and image
            const uploadedImage = req.files && req.files.image && req.files.image[0];
            const uploadedFiles = req.files && req.files.files
                ? req.files.files.map(file => ({
                    filename: file.filename,
                    originalname: file.originalname,
                    url: `/uploads/files/${file.filename}`
                }))
                : [];

            // Ensure files is always null or JSON string!
            const filesJson = uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : null;

            // Prepare notice data
            const noticeData = {
                title: req.body.title,
                description: req.body.description,
                imageUrl: uploadedImage ? `/uploads/images/${uploadedImage.filename}` : null,
                files: filesJson,
                priority: req.body.priority || 'medium',
                status: req.body.status || 'draft'
            };

            console.log(`📝 Creating notice: "${noticeData.title}" by ${req.user.username}`);

            // Create notice
            const notice = await Notice.create(noticeData, req.user);

            console.log(`✅ Notice created successfully: ${notice.title} (ID: ${notice.id})`);

            res.status(201).json({
                success: true,
                message: 'Notice created successfully',
                data: {
                    notice: notice.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Create notice error:', error.message);

            let statusCode = 500;
            let message = 'An error occurred while creating notice';

            if (error.message.includes('Validation failed')) {
                statusCode = 400;
                message = error.message;
            }

            res.status(statusCode).json({
                success: false,
                error: 'Creation Failed',
                message,
                timestamp: new Date().toISOString()
            });
        }
    };

    // Update notice
    updateNotice = async (req, res) => {
        try {
            const { id } = req.params;

            logApiAccess(req, 'UPDATE_NOTICE', { noticeId: id });

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to update notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id));

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions (owner or super_admin can edit)
            if (notice.createdBy !== req.user.id && req.user.role !== 'super_admin') {
                logSecurityEvent(req, 'UNAUTHORIZED_NOTICE_UPDATE', {
                    attemptedBy: req.user.username,
                    noticeId: notice.id,
                    noticeOwner: notice.creatorUsername,
                    severity: 'medium'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'You can only edit your own notices or be a super administrator',
                    timestamp: new Date().toISOString()
                });
            }

            const { title, description, imageUrl, files, priority, status } = req.body;

            // Prepare update data
            const updateData = {};

            if (title !== undefined) updateData.title = title?.toString().trim();
            if (description !== undefined) updateData.description = description?.toString().trim();
            if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
            if (files !== undefined) updateData.files = files;
            if (priority !== undefined) updateData.priority = priority;
            if (status !== undefined) updateData.status = status;

            console.log(`📝 Updating notice: "${notice.title}" by ${req.user.username}`);

            // Update notice
            await notice.update(updateData, req.user);

            console.log(`✅ Notice updated successfully: ${notice.title}`);

            res.status(200).json({
                success: true,
                message: 'Notice updated successfully',
                data: {
                    notice: notice.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Update notice error:', error.message);

            let statusCode = 500;
            let message = 'An error occurred while updating notice';

            if (error.message.includes('Validation failed')) {
                statusCode = 400;
                message = error.message;
            }

            res.status(statusCode).json({
                success: false,
                error: 'Update Failed',
                message,
                timestamp: new Date().toISOString()
            });
        }
    };

    // Delete notice
    deleteNotice = async (req, res) => {
        try {
            const { id } = req.params;

            logApiAccess(req, 'DELETE_NOTICE', { noticeId: id });

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to delete notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id));

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions (owner or super_admin can delete)
            if (notice.createdBy !== req.user.id && req.user.role !== 'super_admin') {
                logSecurityEvent(req, 'UNAUTHORIZED_NOTICE_DELETION', {
                    attemptedBy: req.user.username,
                    noticeId: notice.id,
                    noticeOwner: notice.creatorUsername,
                    severity: 'high'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'You can only delete your own notices or be a super administrator',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`🗑️ Deleting notice: "${notice.title}" by ${req.user.username}`);

            // Delete notice
            await notice.delete(req.user);

            console.log(`✅ Notice deleted successfully: ${notice.title}`);

            res.status(200).json({
                success: true,
                message: 'Notice deleted successfully',
                data: {
                    deletedNotice: {
                        id: notice.id,
                        title: notice.title
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Delete notice error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Deletion Failed',
                message: 'An error occurred while deleting notice',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Publish notice (change status to published)
    publishNotice = async (req, res) => {
        try {
            const { id } = req.params;

            logApiAccess(req, 'PUBLISH_NOTICE', { noticeId: id });

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to publish notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id));

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions
            if (notice.createdBy !== req.user.id && req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'You can only publish your own notices or be a super administrator',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if already published
            if (notice.isPublished()) {
                return res.status(400).json({
                    success: false,
                    error: 'Already Published',
                    message: 'Notice is already published',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`📢 Publishing notice: "${notice.title}" by ${req.user.username}`);

            // Publish notice
            await notice.update({ status: 'published' }, req.user);

            console.log(`✅ Notice published successfully: ${notice.title}`);

            res.status(200).json({
                success: true,
                message: 'Notice published successfully',
                data: {
                    notice: notice.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Publish notice error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Publishing Failed',
                message: 'An error occurred while publishing notice',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Unpublish notice (change status to draft)
    unpublishNotice = async (req, res) => {
        try {
            const { id } = req.params;

            logApiAccess(req, 'UNPUBLISH_NOTICE', { noticeId: id });

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to unpublish notices',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id));

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions
            if (notice.createdBy !== req.user.id && req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'You can only unpublish your own notices or be a super administrator',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if already draft
            if (notice.isDraft()) {
                return res.status(400).json({
                    success: false,
                    error: 'Already Draft',
                    message: 'Notice is already in draft status',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`📝 Unpublishing notice: "${notice.title}" by ${req.user.username}`);

            // Unpublish notice
            await notice.update({ status: 'draft' }, req.user);

            console.log(`✅ Notice unpublished successfully: ${notice.title}`);

            res.status(200).json({
                success: true,
                message: 'Notice unpublished successfully',
                data: {
                    notice: notice.toJSON()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Unpublish notice error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Unpublishing Failed',
                message: 'An error occurred while unpublishing notice',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Search notices
    searchNotices = async (req, res) => {
        try {
            const { q: query, page = 1, limit = 10, published_only = 'true' } = req.query;

            logApiAccess(req, 'SEARCH_NOTICES', { query, page, limit });

            // Validate search query
            if (!query || query.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Search query is required',
                    timestamp: new Date().toISOString()
                });
            }

            if (query.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Search query must be at least 3 characters long',
                    timestamp: new Date().toISOString()
                });
            }

            // Build search options
            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                publishedOnly: published_only === 'true'
            };

            console.log(`🔍 Searching notices: "${query}" with options:`, options);

            // Search notices
            const result = await Notice.search(query, options);

            res.status(200).json({
                success: true,
                message: 'Search completed successfully',
                data: {
                    notices: result.notices.map(notice => notice.toJSON()),
                    pagination: result.pagination,
                    searchQuery: result.searchQuery,
                    totalResults: result.pagination.total
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Search notices error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Search Failed',
                message: 'An error occurred while searching notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get related notices
    getRelatedNotices = async (req, res) => {
        try {
            const { id } = req.params;
            const { limit = 3 } = req.query;

            logApiAccess(req, 'GET_RELATED_NOTICES', { noticeId: id });

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id));

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Get related notices
            const relatedNotices = await notice.getRelated(parseInt(limit));

            res.status(200).json({
                success: true,
                message: 'Related notices retrieved successfully',
                data: {
                    notices: relatedNotices.map(relatedNotice => relatedNotice.toJSON()),
                    count: relatedNotices.length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get related notices error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving related notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get notice analytics
    getNoticeAnalytics = async (req, res) => {
        try {
            const { id } = req.params;
            const { start_date, end_date, group_by = 'day' } = req.query;

            logApiAccess(req, 'GET_NOTICE_ANALYTICS', { noticeId: id });

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to view analytics',
                    timestamp: new Date().toISOString()
                });
            }

            // Validate ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find notice
            const notice = await Notice.findById(parseInt(id));

            if (!notice) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions
            if (notice.createdBy !== req.user.id && req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'You can only view analytics for your own notices or be a super administrator',
                    timestamp: new Date().toISOString()
                });
            }

            // Get analytics
            const analytics = await SiteVisit.getNoticeAnalytics(parseInt(id), {
                startDate: start_date,
                endDate: end_date,
                groupBy: group_by
            });

            res.status(200).json({
                success: true,
                message: 'Notice analytics retrieved successfully',
                data: {
                    notice: {
                        id: notice.id,
                        title: notice.title,
                        slug: notice.slug
                    },
                    analytics
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get notice analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Analytics Failed',
                message: 'An error occurred while retrieving analytics',
                timestamp: new Date().toISOString()
            });
        }
    };
}

// Create and export controller instance
const noticeController = new NoticeController();

module.exports = {
    getAllNotices: noticeController.getAllNotices,
    getNoticeById: noticeController.getNoticeById,
    getNoticeBySlug: noticeController.getNoticeBySlug,
    createNotice: noticeController.createNotice,
    updateNotice: noticeController.updateNotice,
    deleteNotice: noticeController.deleteNotice,
    publishNotice: noticeController.publishNotice,
    unpublishNotice: noticeController.unpublishNotice,
    searchNotices: noticeController.searchNotices,
    getRelatedNotices: noticeController.getRelatedNotices,
    getNoticeAnalytics: noticeController.getNoticeAnalytics
};