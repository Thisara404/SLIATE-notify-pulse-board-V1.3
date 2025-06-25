// Analytics Controller - Comprehensive analytics and reporting
const SiteVisit = require('../models/SiteVisit');
const UserSession = require('../models/UserSession');
const Notice = require('../models/Notice');
const User = require('../models/User');
const sendGAEvent = require('../utils/sendGAEvent');
const {
    logApiAccess,
    logSecurityEvent
} = require('../middleware/logging');
const secureDatabase = require('../config/database');

// Helper functions for role checks
function isAdmin(user) {
    return user && (user.role === 'admin' || user.role === 'super_admin');
}

function isSuperAdmin(user) {
    return user && user.role === 'super_admin';
}

class AnalyticsController {

    // Get dashboard overview analytics
    getDashboardAnalytics = async (req, res) => {
        try {
            logApiAccess(req, 'GET_DASHBOARD_ANALYTICS');

            // Check authentication
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'You must be logged in to view analytics',
                    timestamp: new Date().toISOString()
                });
            }

            // Check permissions (only admins can view analytics)
            if (!isAdmin(req.user)) {
                logSecurityEvent(req, 'UNAUTHORIZED_ANALYTICS_ACCESS', {
                    attemptedBy: req.user.username,
                    severity: 'medium'
                });

                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'Only administrators can view analytics',
                    timestamp: new Date().toISOString()
                });
            }

            await sendGAEvent({
                measurementId: process.env.GOOGLE_ANALYTICS_ID,
                apiSecret: process.env.GA_API_SECRET,
                clientId: req.user?.id?.toString() || 'anonymous', // or req.sessionID, etc.
                eventName: 'dashboard_analytics_viewed',
                params: {
                    username: req.user?.username || 'anonymous',
                    role: req.user?.role || 'unknown',
                    endpoint: req.originalUrl,
                    ip: req.ip,
                }
            });

            console.log(`📊 Dashboard analytics requested by ${req.user.username}`);

            // Get comprehensive dashboard data
            const dashboardData = await SiteVisit.getDashboardData();

            // Get notice statistics
            const noticeStats = await this.getNoticeStatistics();

            // Get user statistics
            const userStats = await this.getUserStatistics();

            // Get session statistics
            const sessionStats = await UserSession.getSessionStats();

            // Get recent activity
            const recentActivity = await this.getRecentActivity();

            const analytics = {
                overview: {
                    totalVisits: dashboardData.overall.total_visits || 0,
                    uniqueVisitors: dashboardData.overall.unique_visitors || 0,
                    todayVisits: dashboardData.today.today_visits || 0,
                    todayVisitors: dashboardData.today.today_visitors || 0,
                    weekVisits: dashboardData.thisWeek.week_visits || 0,
                    weekVisitors: dashboardData.thisWeek.week_visitors || 0,
                    publishedNotices: noticeStats.published || 0,
                    draftNotices: noticeStats.draft || 0,
                    totalUsers: userStats.total || 0,
                    activeSessions: sessionStats.active_sessions || 0
                },
                charts: {
                    dailyVisits: dashboardData.daily || [],
                    topNotices: dashboardData.topNotices || [],
                    referrers: dashboardData.referrers || []
                },
                notices: noticeStats,
                users: userStats,
                sessions: sessionStats,
                recentActivity: recentActivity
            };

            res.status(200).json({
                success: true,
                message: 'Dashboard analytics retrieved successfully',
                data: {
                    analytics,
                    generatedAt: new Date().toISOString(),
                    period: dashboardData.period
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Dashboard analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Analytics Failed',
                message: 'An error occurred while retrieving dashboard analytics',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get detailed site analytics
    getSiteAnalytics = async (req, res) => {
        try {
            const { start_date, end_date, group_by = 'day' } = req.query;

            logApiAccess(req, 'GET_SITE_ANALYTICS', { start_date, end_date, group_by });

            // Check authentication
            if (!req.user || !isAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'Only administrators can view detailed analytics',
                    timestamp: new Date().toISOString()
                });
            }

            // Get site analytics
            const siteAnalytics = await SiteVisit.getSiteAnalytics({
                startDate: start_date,
                endDate: end_date,
                limit: 100
            });

            // Get visitor statistics
            const visitorStats = await SiteVisit.getVisitorStats({
                startDate: start_date,
                endDate: end_date
            });

            console.log(`📈 Site analytics requested by ${req.user.username} for period: ${start_date || 'all'} to ${end_date || 'current'}`);

            res.status(200).json({
                success: true,
                message: 'Site analytics retrieved successfully',
                data: {
                    analytics: siteAnalytics,
                    visitors: visitorStats,
                    period: {
                        startDate: start_date || 'all-time',
                        endDate: end_date || 'current',
                        groupBy: group_by
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Site analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Analytics Failed',
                message: 'An error occurred while retrieving site analytics',
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
            if (!req.user || !isAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'Only administrators can view notice analytics',
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

            // Check permissions (owner or super_admin)
            if (notice.createdBy !== req.user.id && !isSuperAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient Permissions',
                    message: 'You can only view analytics for your own notices or be a super administrator',
                    timestamp: new Date().toISOString()
                });
            }

            // Get notice analytics
            const analytics = await SiteVisit.getNoticeAnalytics(parseInt(id), {
                startDate: start_date,
                endDate: end_date,
                groupBy: group_by
            });

            console.log(`📊 Notice analytics for "${notice.title}" requested by ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'Notice analytics retrieved successfully',
                data: {
                    notice: {
                        id: notice.id,
                        title: notice.title,
                        slug: notice.slug,
                        status: notice.status,
                        priority: notice.priority,
                        publishedAt: notice.publishedAt,
                        createdAt: notice.createdAt
                    },
                    analytics,
                    period: {
                        startDate: start_date || 'all-time',
                        endDate: end_date || 'current',
                        groupBy: group_by
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Notice analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Analytics Failed',
                message: 'An error occurred while retrieving notice analytics',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get user analytics and activity
    getUserAnalytics = async (req, res) => {
        try {
            logApiAccess(req, 'GET_USER_ANALYTICS');

            // Check authentication and permissions
            if (!req.user || !isSuperAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'Only super administrators can view user analytics',
                    timestamp: new Date().toISOString()
                });
            }

            // Get user statistics
            const userStats = await this.getUserStatistics();

            // Get session statistics
            const sessionStats = await UserSession.getSessionStats();

            // Get user activity (notices created, last login, etc.)
            const userActivityQuery = `
        SELECT 
          u.id,
          u.username,
          u.full_name,
          u.role,
          u.created_at,
          COUNT(n.id) as notices_created,
          COUNT(CASE WHEN n.status = 'published' THEN 1 END) as published_notices,
          MAX(s.last_activity) as last_login,
          COUNT(DISTINCT s.id) as total_sessions
        FROM users u
        LEFT JOIN notices n ON u.id = n.created_by
        LEFT JOIN user_sessions s ON u.id = s.user_id
        GROUP BY u.id, u.username, u.full_name, u.role, u.created_at
        ORDER BY notices_created DESC, last_login DESC
        LIMIT 50
      `;

            const userActivityResult = await secureDatabase.executeQuery(userActivityQuery);

            // Get login trends (last 30 days)
            const loginTrendsQuery = `
        SELECT 
          DATE(created_at) as login_date,
          COUNT(*) as login_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY login_date DESC
        LIMIT 30
      `;

            const loginTrendsResult = await secureDatabase.executeQuery(loginTrendsQuery);

            console.log(`👥 User analytics requested by ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'User analytics retrieved successfully',
                data: {
                    overview: userStats,
                    sessions: sessionStats,
                    userActivity: userActivityResult.rows || [],
                    loginTrends: loginTrendsResult.rows || []
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 User analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Analytics Failed',
                message: 'An error occurred while retrieving user analytics',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get content performance analytics
    getContentAnalytics = async (req, res) => {
        try {
            const { limit = 20 } = req.query;

            logApiAccess(req, 'GET_CONTENT_ANALYTICS');

            // Check authentication
            if (!req.user || !isAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'Only administrators can view content analytics',
                    timestamp: new Date().toISOString()
                });
            }

            // Get notice performance
            const noticePerformanceQuery = `
        SELECT 
          n.id,
          n.title,
          n.slug,
          n.priority,
          n.status,
          n.published_at,
          n.created_at,
          u.username as creator,
          COUNT(sv.id) as total_views,
          COUNT(DISTINCT sv.session_id) as unique_viewers,
          COUNT(DISTINCT sv.ip_address) as unique_ips,
          AVG(CASE WHEN sv.visit_time IS NOT NULL THEN 1 ELSE 0 END) as engagement_rate
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        LEFT JOIN site_visits sv ON n.id = sv.notice_id
        WHERE n.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY n.id, n.title, n.slug, n.status, n.priority, n.published_at, n.created_at, u.username
        ORDER BY total_views DESC, unique_viewers DESC
        LIMIT ?
      `;

            const performanceResult = await secureDatabase.executeQuery(noticePerformanceQuery, [
                Math.min(100, parseInt(limit))
            ]);

            // Get content trends by priority
            const priorityTrendsQuery = `
        SELECT 
          n.priority,
          COUNT(*) as total_notices,
          COUNT(CASE WHEN n.status = 'published' THEN 1 END) as published_notices,
          AVG(sv_stats.view_count) as avg_views,
          AVG(sv_stats.unique_viewers) as avg_unique_viewers
        FROM notices n
        LEFT JOIN (
          SELECT 
            notice_id,
            COUNT(*) as view_count,
            COUNT(DISTINCT session_id) as unique_viewers
          FROM site_visits
          GROUP BY notice_id
        ) sv_stats ON n.id = sv_stats.notice_id
        WHERE n.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY n.priority
        ORDER BY avg_views DESC
      `;

            const priorityTrendsResult = await secureDatabase.executeQuery(priorityTrendsQuery);

            // Get publishing trends (last 30 days)
            const publishingTrendsQuery = `
        SELECT 
          DATE(published_at) as publish_date,
          COUNT(*) as published_count,
          COUNT(DISTINCT created_by) as publishers
        FROM notices
        WHERE published_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND status = 'published'
        GROUP BY DATE(published_at)
        ORDER BY publish_date DESC
        LIMIT 30
      `;

            const publishingTrendsResult = await secureDatabase.executeQuery(publishingTrendsQuery);

            console.log(`📝 Content analytics requested by ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'Content analytics retrieved successfully',
                data: {
                    noticePerformance: performanceResult.rows || [],
                    priorityTrends: priorityTrendsResult.rows || [],
                    publishingTrends: publishingTrendsResult.rows || [],
                    period: '90 days'
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Content analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Analytics Failed',
                message: 'An error occurred while retrieving content analytics',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Get security analytics
    getSecurityAnalytics = async (req, res) => {
        try {
            logApiAccess(req, 'GET_SECURITY_ANALYTICS');

            // Check authentication and permissions
            if (!req.user || !isSuperAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'Only super administrators can view security analytics',
                    timestamp: new Date().toISOString()
                });
            }

            // Detect suspicious sessions
            const suspiciousSessions = await UserSession.detectSuspiciousSessions();

            // Get failed login attempts (if logging exists)
            const failedLoginsQuery = `
        SELECT 
          DATE(created_at) as attempt_date,
          COUNT(*) as failed_attempts,
          COUNT(DISTINCT user_id) as affected_users
        FROM user_sessions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND is_active = FALSE
        GROUP BY DATE(created_at)
        ORDER BY attempt_date DESC
        LIMIT 7
      `;

            const failedLoginsResult = await secureDatabase.executeQuery(failedLoginsQuery);

            // Get session security metrics
            const securityMetricsQuery = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_sessions,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip_address) as unique_ips,
          AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(last_activity, NOW()))) as avg_session_duration
        FROM user_sessions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;

            const securityMetricsResult = await secureDatabase.executeQuery(securityMetricsQuery);

            // Check for suspicious activity
            const suspiciousActivityQuery = `
        SELECT 
          sv.ip_address,
          COUNT(*) as visit_count,
          COUNT(DISTINCT sv.session_id) as session_count,
          MIN(sv.visit_time) as first_visit,
          MAX(sv.visit_time) as last_visit,
          COUNT(DISTINCT sv.notice_id) as notices_viewed
        FROM site_visits sv
        WHERE sv.visit_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY sv.ip_address
        HAVING visit_count > 100 OR session_count > 10
        ORDER BY visit_count DESC
        LIMIT 20
      `;

            const suspiciousActivityResult = await secureDatabase.executeQuery(suspiciousActivityQuery);

            console.log(`🔒 Security analytics requested by ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'Security analytics retrieved successfully',
                data: {
                    suspiciousSessions: suspiciousSessions || [],
                    failedLogins: failedLoginsResult.rows || [],
                    securityMetrics: securityMetricsResult.rows[0] || {},
                    suspiciousActivity: suspiciousActivityResult.rows || [],
                    generatedAt: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Security analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Security Analytics Failed',
                message: 'An error occurred while retrieving security analytics',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Export analytics data
    exportAnalytics = async (req, res) => {
        try {
            const { type = 'visits', format = 'json', start_date, end_date } = req.query;

            logApiAccess(req, 'EXPORT_ANALYTICS', { type, format });

            // Check authentication and permissions
            if (!req.user || !isSuperAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access Denied',
                    message: 'Only super administrators can export analytics',
                    timestamp: new Date().toISOString()
                });
            }

            let exportData = {};
            let filename = `analytics_${type}_${new Date().toISOString().split('T')[0]}`;

            switch (type) {
                case 'visits':
                    exportData = await this.exportVisitsData(start_date, end_date);
                    break;
                case 'notices':
                    exportData = await this.exportNoticesData();
                    break;
                case 'users':
                    exportData = await this.exportUsersData();
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid Export Type',
                        message: 'Export type must be visits, notices, or users',
                        timestamp: new Date().toISOString()
                    });
            }

            if (format === 'csv') {
                // Convert to CSV format
                const csv = this.convertToCSV(exportData);

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

                return res.status(200).send(csv);
            }

            // Default JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

            console.log(`📊 Analytics export (${type}) by ${req.user.username}`);

            res.status(200).json({
                success: true,
                message: 'Analytics exported successfully',
                data: exportData,
                metadata: {
                    type,
                    format,
                    period: {
                        startDate: start_date || 'all-time',
                        endDate: end_date || 'current'
                    },
                    exportedAt: new Date().toISOString(),
                    exportedBy: req.user.username
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('💥 Export analytics error:', error.message);

            res.status(500).json({
                success: false,
                error: 'Export Failed',
                message: 'An error occurred while exporting analytics',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Helper method: Get notice statistics
    async getNoticeStatistics() {
        try {
            const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as created_this_month,
          COUNT(CASE WHEN published_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as published_this_month
        FROM notices
      `;

            const result = await secureDatabase.executeQuery(query);
            return result.rows[0] || {};
        } catch (error) {
            console.error('💥 Error getting notice statistics:', error.message);
            return {};
        }
    }

    // Helper method: Get user statistics
    async getUserStatistics() {
        try {
            const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
          COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admins,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as created_this_month
        FROM users
      `;

            const result = await secureDatabase.executeQuery(query);
            return result.rows[0] || {};
        } catch (error) {
            console.error('💥 Error getting user statistics:', error.message);
            return {};
        }
    }

    // Helper method: Get recent activity
    async getRecentActivity(limit = 20) {
        try {
            const query = `
        (SELECT 'notice_created' as activity_type, n.title as description, n.created_at as activity_time, u.username as actor
         FROM notices n
         LEFT JOIN users u ON n.created_by = u.id
         WHERE n.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY n.created_at DESC
         LIMIT 10)
        UNION ALL
        (SELECT 'notice_published' as activity_type, n.title as description, n.published_at as activity_time, u.username as actor
         FROM notices n
         LEFT JOIN users u ON n.created_by = u.id
         WHERE n.published_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY n.published_at DESC
         LIMIT 10)
        ORDER BY activity_time DESC
        LIMIT ?
      `;

            const result = await secureDatabase.executeQuery(query, [limit]);
            return result.rows || [];
        } catch (error) {
            console.error('💥 Error getting recent activity:', error.message);
            return [];
        }
    }

    // Helper method: Export visits data
    async exportVisitsData(startDate, endDate) {
        try {
            let query = `
        SELECT 
          sv.id,
          sv.notice_id,
          n.title as notice_title,
          sv.ip_address,
          sv.visit_date,
          sv.visit_time,
          sv.session_id,
          sv.country,
          sv.city,
          sv.referer
        FROM site_visits sv
        LEFT JOIN notices n ON sv.notice_id = n.id
        WHERE 1=1
      `;

            const params = [];

            if (startDate) {
                query += ` AND DATE(sv.visit_time) >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                query += ` AND DATE(sv.visit_time) <= ?`;
                params.push(endDate);
            }

            query += ` ORDER BY sv.visit_time DESC LIMIT 10000`;

            const result = await secureDatabase.executeQuery(query, params);
            return result.rows || [];
        } catch (error) {
            console.error('💥 Error exporting visits data:', error.message);
            return [];
        }
    }

    // Helper method: Export notices data
    async exportNoticesData() {
        try {
            const query = `
        SELECT 
          n.id,
          n.title,
          n.slug,
          n.status,
          n.priority,
          n.created_at,
          n.published_at,
          u.username as creator,
          COUNT(sv.id) as total_views,
          COUNT(DISTINCT sv.session_id) as unique_viewers
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        LEFT JOIN site_visits sv ON n.id = sv.notice_id
        GROUP BY n.id, n.title, n.slug, n.status, n.priority, n.created_at, n.published_at, u.username
        ORDER BY n.created_at DESC
      `;

            const result = await secureDatabase.executeQuery(query);
            return result.rows || [];
        } catch (error) {
            console.error('💥 Error exporting notices data:', error.message);
            return [];
        }
    }

    // Helper method: Export users data
    async exportUsersData() {
        try {
            const query = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.role,
          u.full_name,
          u.created_at,
          COUNT(n.id) as notices_created,
          COUNT(CASE WHEN n.status = 'published' THEN 1 END) as published_notices,
          MAX(s.last_activity) as last_login
        FROM users u
        LEFT JOIN notices n ON u.id = n.created_by
        LEFT JOIN user_sessions s ON u.id = s.user_id
        GROUP BY u.id, u.username, u.email, u.role, u.full_name, u.created_at
        ORDER BY u.created_at DESC
      `;

            const result = await secureDatabase.executeQuery(query);
            return result.rows || [];
        } catch (error) {
            console.error('💥 Error exporting users data:', error.message);
            return [];
        }
    }

    // Helper method: Convert data to CSV
    convertToCSV(data) {
        try {
            if (!data || data.length === 0) {
                return 'No data available';
            }

            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(header => {
                        const value = row[header];
                        // Escape quotes and wrap in quotes if contains comma or quote
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    }).join(',')
                )
            ];

            return csvContent.join('\n');
        } catch (error) {
            console.error('💥 Error converting to CSV:', error.message);
            return 'Error converting data to CSV';
        }
    }
}

// Create and export controller instance
const analyticsController = new AnalyticsController();

module.exports = {
    getDashboardAnalytics: analyticsController.getDashboardAnalytics,
    getSiteAnalytics: analyticsController.getSiteAnalytics,
    getNoticeAnalytics: analyticsController.getNoticeAnalytics,
    getUserAnalytics: analyticsController.getUserAnalytics,
    getContentAnalytics: analyticsController.getContentAnalytics,
    getSecurityAnalytics: analyticsController.getSecurityAnalytics,
    exportAnalytics: analyticsController.exportAnalytics
};