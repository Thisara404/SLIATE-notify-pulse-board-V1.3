// Public Controller - Public-facing API endpoints (no authentication required)
const Notice = require('../models/Notice');
const SiteVisit = require('../models/SiteVisit');
const User = require('../models/User');
const {
    logApiAccess,
    logSecurityEvent
} = require('../middleware/logging');
const rateLimit = require('express-rate-limit');

function getDescriptionString(desc) {
    if (typeof desc === 'string') return desc;
    if (Buffer.isBuffer(desc)) return desc.toString('utf8');
    if (desc && typeof desc === 'object' && Array.isArray(desc.data)) {
        return Buffer.from(desc.data).toString('utf8');
    }
    return '';
}

class PublicController {
    constructor() {
        // Rate limiting for public endpoints
        this.publicLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window per IP
            message: {
                success: false,
                error: 'Rate Limit Exceeded',
                message: 'Too many requests, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.searchLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 50, // 50 searches per window per IP
            message: {
                success: false,
                error: 'Search Rate Limit',
                message: 'Too many search requests, please try again later',
                retryAfter: '15 minutes'
            }
        });
    }

    // Get site information and stats
    getSiteInfo = async (req, res) => {
        try {
            logApiAccess(req, 'GET_SITE_INFO');

            // Generate a session ID for this visitor if not exists
            const sessionId = req.sessionID || `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Record homepage visit
            try {
                await SiteVisit.recordVisit({
                    noticeId: null, // Homepage visit
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.headers['user-agent'],
                    referer: req.headers.referer,
                    sessionId: sessionId,
                    country: req.geoip?.country || null,
                    city: req.geoip?.city || null
                });
            } catch (visitError) {
                console.warn('⚠️ Error recording site visit:', visitError.message);
                // Continue even if visit recording fails
            }

            // Get basic site statistics
            const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM notices WHERE status = 'published') as published_notices,
          (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin')) as total_admins,
          (SELECT COUNT(*) FROM site_visits WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as monthly_visits,
          (SELECT COUNT(DISTINCT session_id) FROM site_visits WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as monthly_visitors
      `;

            const secureDatabase = require('../config/database');
            const statsResult = await secureDatabase.executeQuery(statsQuery);
            const stats = statsResult.rows[0] || {};

            // Get recent published notices (last 5)
            const recentNotices = await Notice.getAll({
                page: 1,
                limit: 5,
                publishedOnly: true,
                sortBy: 'published_at',
                sortOrder: 'DESC'
            });

            console.log(`🏠 Site info requested from ${req.ip}`);

            res.status(200).json({
                success: true,
                message: 'Site information retrieved successfully',
                data: {
                    site: {
                        name: 'SLIATE Notice System',
                        description: 'Official notice board for SLIATE announcements and updates',
                        version: '1.3.0',
                        lastUpdated: new Date().toISOString()
                    },
                    statistics: {
                        publishedNotices: parseInt(stats.published_notices) || 0,
                        totalAdmins: parseInt(stats.total_admins) || 0,
                        monthlyVisits: parseInt(stats.monthly_visits) || 0,
                        monthlyVisitors: parseInt(stats.monthly_visitors) || 0
                    },
                    recentNotices: recentNotices.notices.map(notice => ({
                        id: notice.id,
                        title: notice.title,
                        slug: notice.slug,
                        priority: notice.priority,
                        publishedAt: notice.publishedAt,
                        creatorName: notice.creatorName
                    })),
                    sessionId: sessionId
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get site info error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Site Info Error',
                message: 'An error occurred while retrieving site information',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get published notices (public view)
    getPublishedNotices = async (req, res) => {
        try {
            const { page = 1, limit = 10, priority, search, sortBy = 'published_at', sortOrder = 'DESC' } = req.query;
            
            logApiAccess(req, 'GET_PUBLISHED_NOTICES');
            
            // Step 1: Get distinct dates with notice counts (pagination by dates)
            let dateQuery = `
                SELECT 
                    DATE(published_at) as notice_date,
                    COUNT(*) as notice_count
                FROM notices 
                WHERE status = 'published' AND published_at IS NOT NULL
            `;
            
            const dateParams = [];
            
            // Add search filter for dates
            if (search && search.trim().length > 0) {
                dateQuery += ` AND (title LIKE ? OR description LIKE ?)`;
                const searchTerm = `%${search.trim()}%`;
                dateParams.push(searchTerm, searchTerm);
            }
            
            // Add priority filter for dates
            if (priority) {
                dateQuery += ` AND priority = ?`;
                dateParams.push(priority);
            }
            
            dateQuery += `
                GROUP BY DATE(published_at)
                ORDER BY notice_date DESC
                LIMIT ? OFFSET ?
            `;
            
            const offset = (parseInt(page) - 1) * parseInt(limit);
            dateParams.push(parseInt(limit), offset);
            
            const dateResult = await secureDatabase.executeQuery(dateQuery, dateParams);
            
            if (!dateResult.rows || dateResult.rows.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: 'No notices found',
                    data: {
                        noticeGroups: [],
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            totalDates: 0,
                            totalPages: 0,
                            totalNotices: 0
                        }
                    }
                });
            }
            
            // Get total count of dates for pagination
            let countQuery = `
                SELECT COUNT(DISTINCT DATE(published_at)) as total_dates,
                       COUNT(*) as total_notices
                FROM notices 
                WHERE status = 'published' AND published_at IS NOT NULL
            `;
            
            const countParams = [];
            if (search && search.trim().length > 0) {
                countQuery += ` AND (title LIKE ? OR description LIKE ?)`;
                const searchTerm = `%${search.trim()}%`;
                countParams.push(searchTerm, searchTerm);
            }
            
            if (priority) {
                countQuery += ` AND priority = ?`;
                countParams.push(priority);
            }
            
            const countResult = await secureDatabase.executeQuery(countQuery, countParams);
            const totalDates = countResult.rows[0]?.total_dates || 0;
            const totalNotices = countResult.rows[0]?.total_notices || 0;
            
            // Step 2: Get all notices for the selected dates
            const selectedDates = dateResult.rows.map(row => row.notice_date);
            const placeholders = selectedDates.map(() => 'DATE(published_at) = ?').join(' OR ');
            
            let noticesQuery = `
                SELECT n.*, u.username as creator_username, u.full_name as creator_name
                FROM notices n
                LEFT JOIN users u ON n.created_by = u.id
                WHERE n.status = 'published' 
                AND n.published_at IS NOT NULL
                AND (${placeholders})
            `;
            
            const noticesParams = [...selectedDates];
            
            // Add search filter for notices
            if (search && search.trim().length > 0) {
                noticesQuery += ` AND (n.title LIKE ? OR n.description LIKE ?)`;
                const searchTerm = `%${search.trim()}%`;
                noticesParams.push(searchTerm, searchTerm);
            }
            
            // Add priority filter for notices
            if (priority) {
                noticesQuery += ` AND n.priority = ?`;
                noticesParams.push(priority);
            }
            
            // Order by date DESC, then by priority (high -> medium -> low)
            noticesQuery += `
                ORDER BY 
                    DATE(n.published_at) DESC,
                    CASE n.priority 
                        WHEN 'high' THEN 1 
                        WHEN 'medium' THEN 2 
                        WHEN 'low' THEN 3 
                        ELSE 4 
                    END ASC,
                    n.published_at DESC
            `;
            
            const noticesResult = await secureDatabase.executeQuery(noticesQuery, noticesParams);
            
            // Step 3: Group notices by date
            const noticeGroups = [];
            const today = new Date().toDateString();
            
            selectedDates.forEach(date => {
                const dateStr = new Date(date).toDateString();
                const dateNotices = noticesResult.rows.filter(notice => 
                    new Date(notice.published_at).toDateString() === dateStr
                );
                
                if (dateNotices.length > 0) {
                    // Process files for each notice
                    const processedNotices = dateNotices.map(notice => {
                        const desc = getDescriptionString(notice.description);
                        
                        let processedFiles = [];
                        if (notice.files) {
                            try {
                                let filesArray = [];
                                if (typeof notice.files === 'string') {
                                    filesArray = JSON.parse(notice.files);
                            } else if (Array.isArray(notice.files)) {
                                filesArray = notice.files;
                            } else if (notice.files.type === 'Buffer' && Array.isArray(notice.files.data)) {
                                const buffer = Buffer.from(notice.files.data);
                                const jsonString = buffer.toString('utf8');
                                filesArray = JSON.parse(jsonString);
                            }
                            
                            processedFiles = filesArray.map(file => ({
                                name: file.name || file.originalName || 'Unknown File',
                                url: file.url.startsWith('http') ? file.url : `${req.protocol}://${req.get('host')}${file.url}`,
                                size: file.size || 0,
                                type: file.type || file.mimetype || ''
                            }));
                        } catch (error) {
                            console.error('Error processing files for notice', notice.id, ':', error);
                            processedFiles = [];
                        }
                    }
                    
                    return {
                        id: notice.id,
                        title: notice.title,
                        description: desc.substring(0, 250) + (desc.length > 250 ? '...' : ''),
                        imageUrl: notice.image_url,
                        files: processedFiles,
                        priority: notice.priority,
                        slug: notice.slug,
                        publishedAt: notice.published_at,
                        creatorName: notice.creator_name,
                        viewCount: parseInt(notice.view_count || '0'),
                    };
                });
                
                noticeGroups.push({
                    date: dateStr,
                    displayDate: dateStr === today ? 'Today' : new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }),
                    isToday: dateStr === today,
                    notices: processedNotices,
                    noticeCount: processedNotices.length
                });
            }
        });
        
        res.status(200).json({
            success: true,
            message: 'Notice groups retrieved successfully',
            data: {
                noticeGroups,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalDates: parseInt(totalDates),
                    totalPages: Math.ceil(totalDates / parseInt(limit)),
                    totalNotices: parseInt(totalNotices)
                },
                filters: {
                    priority,
                    search
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Get published notices error:', error.message);

        res.status(500).json({
            success: false,
            error: 'Retrieval Failed',
            message: 'An error occurred while retrieving notices',
            timestamp: new Date().toISOString()
        });
    }
};
    // Get single published notice by slug (public view)
    getPublishedNoticeBySlug = async (req, res) => {
        try {
            const { slug } = req.params;
            
            // Log the incoming slug
            console.log(`🔍 Looking for notice with slug: '${slug}'`);

            logApiAccess(req, 'GET_PUBLISHED_NOTICE', { slug });

            // Validate slug
            if (!slug || typeof slug !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Valid notice slug is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Find published notice
            const notice = await Notice.findBySlug(slug, true); // Include stats

            // Log whether notice was found
            console.log(`📄 Notice lookup result: ${notice ? 'Found' : 'Not found'}`);

            if (!notice || !notice.isPublished()) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice Not Found',
                    message: 'Notice not found or not published',
                    timestamp: new Date().toISOString()
                });
            }

            // Generate a session ID for this visitor
            const sessionId = req.sessionID || `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Record notice visit
            try {
                await SiteVisit.recordVisit({
                    noticeId: notice.id,
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.headers['user-agent'],
                    referer: req.headers.referer,
                    sessionId: sessionId,
                    country: req.geoip?.country || null,
                    city: req.geoip?.city || null
                });
            } catch (visitError) {
                console.warn('⚠️ Error recording notice visit:', visitError.message);
                // Continue even if visit recording fails
            }

            // Get related notices
            const relatedNotices = await notice.getRelated(3);

            console.log(`📄 Public notice viewed: "${notice.title}" from ${req.ip}`);

            // Prepare public notice data
            const publicNotice = {
                id: notice.id,
                title: notice.title,
                description: notice.description,
                imageUrl: notice.imageUrl,
                files: Array.isArray(notice.files) ? notice.files.map(file => {
                    // Ensure each file has the required properties
                    if (!file || typeof file !== 'object') {
                        return null;
                    }
                    
                    return {
                        name: file.name || (file.url ? file.url.split('/').pop() : 'unknown'),
                        url: file.url || '',
                        size: file.size || 0,
                        type: file.type || ''
                    };
                }).filter(Boolean) : [], // Remove any null entries
                priority: notice.priority,
                slug: notice.slug,
                publishedAt: notice.publishedAt,
                creatorName: notice.creatorName,
                viewCount: parseInt(notice.viewCount || '0'), // Ensure viewCount is always a number
                uniqueViewers: parseInt(notice.uniqueViewers || '0') // Ensure uniqueViewers is always a number
            };

            const publicRelatedNotices = relatedNotices.map(related => ({
                id: related.id,
                title: related.title,
                slug: related.slug,
                priority: related.priority,
                publishedAt: related.publishedAt,
                creatorName: related.creatorName
            }));

            // Add this to the getPublishedNoticeBySlug method before sending the response
            console.log('📄 Sending public notice with files:', JSON.stringify(publicNotice.files, null, 2));

            res.status(200).json({
                success: true,
                message: 'Notice retrieved successfully',
                data: {
                    notice: publicNotice,
                    relatedNotices: publicRelatedNotices,
                    sessionId: sessionId
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get published notice error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving notice',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Search published notices (public)
    searchPublishedNotices = async (req, res) => {
        try {
            const { q: query, page = 1, limit = 10 } = req.query;

            logApiAccess(req, 'SEARCH_PUBLISHED_NOTICES', { query, page, limit });

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

            // Build search options (published only)
            const options = {
                page: parseInt(page),
                limit: Math.min(20, parseInt(limit)), // Limit to 20 for public search
                publishedOnly: true
            };

            console.log(`🔍 Public search: "${query}" from ${req.ip}`);

            // Search published notices
            const result = await Notice.search(query, options);

            // Sanitize results for public
            const publicNotices = result.notices.map(notice => {
                const desc = getDescriptionString(notice.description);
                return {
                    id: notice.id,
                    title: notice.title,
                    description: desc.substring(0, 300) + (desc.length > 300 ? '...' : ''),
                    imageUrl: notice.imageUrl,
                    priority: notice.priority,
                    slug: notice.slug,
                    publishedAt: notice.publishedAt,
                    creatorName: notice.creatorName
                }
            });

            res.status(200).json({
                success: true,
                message: 'Search completed successfully',
                data: {
                    notices: publicNotices,
                    pagination: result.pagination,
                    searchQuery: result.searchQuery,
                    totalResults: result.pagination.total
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Public search error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Search Failed',
                message: 'An error occurred while searching notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get notices by priority (public)
    getNoticesByPriority = async (req, res) => {
        try {
            const { priority } = req.params;
            const { page = 1, limit = 10 } = req.query;

            logApiAccess(req, 'GET_NOTICES_BY_PRIORITY', { priority });

            // Validate priority
            if (!['low', 'medium', 'high'].includes(priority)) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    message: 'Priority must be low, medium, or high',
                    timestamp: new Date().toISOString()
                });
            }

            // Get notices by priority
            const result = await Notice.getAll({
                page: parseInt(page),
                limit: Math.min(20, parseInt(limit)),
                priority,
                publishedOnly: true,
                sortBy: 'published_at',
                sortOrder: 'DESC'
            });

            // Sanitize for public
            const publicNotices = result.notices.map(notice => ({
                id: notice.id,
                title: notice.title,
                description: notice.description.substring(0, 250) + (notice.description.length > 250 ? '...' : ''),
                imageUrl: notice.imageUrl,
                priority: notice.priority,
                slug: notice.slug,
                publishedAt: notice.publishedAt,
                creatorName: notice.creatorName
            }));

            console.log(`📋 ${priority} priority notices requested from ${req.ip}`);

            res.status(200).json({
                success: true,
                message: `${priority.charAt(0).toUpperCase() + priority.slice(1)} priority notices retrieved successfully`,
                data: {
                    notices: publicNotices,
                    pagination: result.pagination,
                    priority: priority
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get notices by priority error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get latest notices (public)
    getLatestNotices = async (req, res) => {
        try {
            const { limit = 5 } = req.query;

            logApiAccess(req, 'GET_LATEST_NOTICES');

            // Get latest published notices
            const result = await Notice.getAll({
                page: 1,
                limit: Math.min(10, parseInt(limit)), // Max 10 for latest
                publishedOnly: true,
                sortBy: 'published_at',
                sortOrder: 'DESC'
            });

            // Sanitize for public
            const latestNotices = result.notices.map(notice => {
                const desc = getDescriptionString(notice.description);
                return {
                    id: notice.id,
                    title: notice.title,
                    description: desc.substring(0, 150) + (desc.length > 150 ? '...' : ''),
                    imageUrl: notice.imageUrl,
                    priority: notice.priority,
                    slug: notice.slug,
                    publishedAt: notice.publishedAt,
                    creatorName: notice.creatorName
                };
            });

            console.log(`📋 Latest notices requested from ${req.ip}`);

            res.status(200).json({
                success: true,
                message: 'Latest notices retrieved successfully',
                data: {
                    notices: latestNotices,
                    count: latestNotices.length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get latest notices error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving latest notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get popular notices (most viewed)
    getPopularNotices = async (req, res) => {
        try {
            const { limit = 5, days = 30 } = req.query;

            logApiAccess(req, 'GET_POPULAR_NOTICES');

            const secureDatabase = require('../config/database');

            // Get popular notices based on views in the last X days
            const query = `
        SELECT n.id, n.title, n.description, n.image_url, n.priority, n.slug, 
               n.published_at, u.full_name as creator_name,
               COUNT(sv.id) as view_count,
               COUNT(DISTINCT sv.session_id) as unique_viewers
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        LEFT JOIN site_visits sv ON n.id = sv.notice_id 
          AND sv.visit_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
        WHERE n.status = 'published' 
          AND n.published_at IS NOT NULL
        GROUP BY n.id, n.title, n.description, n.image_url, n.priority, n.slug, n.published_at, u.full_name
        ORDER BY view_count DESC, unique_viewers DESC, n.published_at DESC
        LIMIT ?
      `;

            const result = await secureDatabase.executeQuery(query, [
                parseInt(days),
                Math.min(10, parseInt(limit))
            ]);

            // Format popular notices
            const popularNotices = result.rows.map(notice => {
                const desc = getDescriptionString(notice.description);
                return {
                    id: notice.id,
                    title: notice.title,
                    description: desc.substring(0, 200) + (desc.length > 200 ? '...' : ''),
                    imageUrl: notice.image_url,
                    priority: notice.priority,
                    slug: notice.slug,
                    publishedAt: notice.published_at,
                    creatorName: notice.creator_name,
                    viewCount: parseInt(notice.view_count) || 0,
                    uniqueViewers: parseInt(notice.unique_viewers) || 0
                };
            });

            console.log(`📈 Popular notices requested from ${req.ip}`);

            res.status(200).json({
                success: true,
                message: 'Popular notices retrieved successfully',
                data: {
                    notices: popularNotices,
                    period: `${days} days`,
                    count: popularNotices.length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get popular notices error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Retrieval Failed',
                message: 'An error occurred while retrieving popular notices',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get notice archive (grouped by month)
    getNoticeArchive = async (req, res) => {
        try {
            const { year, month } = req.query;

            logApiAccess(req, 'GET_NOTICE_ARCHIVE', { year, month });

            const secureDatabase = require('../config/database');

            let query, params;

            if (year && month) {
                // Get notices for specific month
                query = `
          SELECT n.id, n.title, n.slug, n.priority, n.published_at, u.full_name as creator_name
          FROM notices n
          LEFT JOIN users u ON n.created_by = u.id
          WHERE n.status = 'published' 
            AND YEAR(n.published_at) = ? 
            AND MONTH(n.published_at) = ?
          ORDER BY n.published_at DESC
          LIMIT 50
        `;
                params = [parseInt(year), parseInt(month)];
            } else {
                // Get archive summary (months with notice counts)
                query = `
          SELECT 
            YEAR(published_at) as year,
            MONTH(published_at) as month,
            MONTHNAME(published_at) as month_name,
            COUNT(*) as notice_count
          FROM notices
          WHERE status = 'published' AND published_at IS NOT NULL
          GROUP BY YEAR(published_at), MONTH(published_at)
          ORDER BY year DESC, month DESC
          LIMIT 24
        `;
                params = [];
            }

            const result = await secureDatabase.executeQuery(query, params);

            let responseData;

            if (year && month) {
                // Return notices for specific month
                responseData = {
                    notices: result.rows,
                    year: parseInt(year),
                    month: parseInt(month),
                    count: result.rows.length
                };
            } else {
                // Return archive summary
                responseData = {
                    archive: result.rows,
                    totalMonths: result.rows.length
                };
            }

            console.log(`📅 Notice archive requested from ${req.ip}`);

            res.status(200).json({
                success: true,
                message: 'Notice archive retrieved successfully',
                data: responseData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Get notice archive error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Archive Failed',
                message: 'An error occurred while retrieving notice archive',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Health check endpoint
    healthCheck = async (req, res) => {
        try {
            const secureDatabase = require('../config/database');

            // Quick database health check
            const dbResult = await secureDatabase.executeQuery('SELECT 1 as health_check');
            const isDbHealthy = dbResult.rows && dbResult.rows[0].health_check === 1;

            const health = {
                status: isDbHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                database: isDbHealthy ? 'connected' : 'disconnected',
                version: '1.3.0',
                uptime: process.uptime()
            };

            const statusCode = isDbHealthy ? 200 : 503;

            res.status(statusCode).json({
                success: isDbHealthy,
                message: isDbHealthy ? 'System healthy' : 'System unhealthy',
                data: health,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Health check error:', error.message);

            res.status(503).json({
                success: false,
                error: 'Health Check Failed',
                message: 'System health check failed',
                data: {
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    error: error.message
                },
                timestamp: new Date().toISOString()
            });
        }
    };
}

// Create and export controller instance
const publicController = new PublicController();

module.exports = {
    // Rate limited endpoints
    getSiteInfo: [publicController.publicLimiter, publicController.getSiteInfo],
    getPublishedNotices: [publicController.publicLimiter, publicController.getPublishedNotices],
    getPublishedNoticeBySlug: [publicController.publicLimiter, publicController.getPublishedNoticeBySlug],
    searchPublishedNotices: [publicController.searchLimiter, publicController.searchPublishedNotices],
    getNoticesByPriority: [publicController.publicLimiter, publicController.getNoticesByPriority],
    getLatestNotices: [publicController.publicLimiter, publicController.getLatestNotices],
    getPopularNotices: [publicController.publicLimiter, publicController.getPopularNotices],
    getNoticeArchive: [publicController.publicLimiter, publicController.getNoticeArchive],

    // Health check (no rate limit)
    healthCheck: publicController.healthCheck
};