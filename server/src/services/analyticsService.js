// Analytics Service - Business logic for analytics and reporting
const SiteVisit = require('../models/SiteVisit');
const UserSession = require('../models/UserSession');
const Notice = require('../models/Notice');
const User = require('../models/User');
const secureDatabase = require('../config/database');
const { 
  logUserAction, 
  logPerformance,
  logSecurityEvent 
} = require('../utils/logger');

class AnalyticsService {
  constructor() {
    // Analytics configuration
    this.config = {
      defaultDateRange: 30, // days
      maxDateRange: 365, // days
      realTimeThreshold: 5 * 60 * 1000, // 5 minutes
      cacheTimeout: 15 * 60 * 1000, // 15 minutes
      maxExportRecords: 50000,
      supportedExportFormats: ['json', 'csv', 'xlsx'],
      aggregationLevels: ['hour', 'day', 'week', 'month'],
      retentionPeriod: 90 // days
    };

    // Metrics definitions
    this.metrics = {
      traffic: {
        totalVisits: 'Total page visits',
        uniqueVisitors: 'Unique visitors',
        pageViews: 'Individual page views',
        sessionDuration: 'Average session duration',
        bounceRate: 'Bounce rate percentage'
      },
      content: {
        topPages: 'Most visited pages',
        popularNotices: 'Most viewed notices',
        searchQueries: 'Popular search terms',
        downloadCounts: 'File download counts'
      },
      user: {
        newUsers: 'New user registrations',
        activeUsers: 'Active users',
        userSessions: 'User session data',
        roleDistribution: 'User role distribution'
      },
      performance: {
        pageLoadTimes: 'Page load performance',
        apiResponseTimes: 'API response times',
        errorRates: 'Error occurrence rates',
        serverMetrics: 'Server performance'
      },
      security: {
        failedLogins: 'Failed login attempts',
        suspiciousActivity: 'Security incidents',
        rateLimitHits: 'Rate limit violations',
        unauthorizedAccess: 'Access violations'
      }
    };

    // Cache for frequently accessed data
    this.cache = new Map();
  }

  /**
   * Get comprehensive dashboard analytics
   * @param {Object} options - Analytics options
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - Dashboard analytics
   */
  async getDashboardAnalytics(options = {}, user, context = {}) {
    try {
      const startTime = Date.now();
      console.log(`📊 Getting dashboard analytics for ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkAnalyticsPermissions(user, 'dashboard');
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Parse date range
      const dateRange = this.parseDateRange(options);

      // Step 3: Get cached data if available
      const cacheKey = `dashboard_${user.id}_${dateRange.start}_${dateRange.end}`;
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('📋 Returning cached dashboard data');
        return cachedData;
      }

      // Step 4: Gather analytics data
      const [
        trafficData,
        contentData,
        userMetrics,
        performanceData,
        securityMetrics
      ] = await Promise.all([
        this.getTrafficAnalytics(dateRange, user),
        this.getContentAnalytics(dateRange, user),
        this.getUserAnalytics(dateRange, user),
        this.getPerformanceAnalytics(dateRange, user),
        this.getSecurityAnalytics(dateRange, user)
      ]);

      // Step 5: Compile dashboard data
      const dashboardData = {
        success: true,
        dateRange,
        overview: {
          totalVisits: trafficData.summary.totalVisits || 0,
          uniqueVisitors: trafficData.summary.uniqueVisitors || 0,
          publishedNotices: contentData.summary.publishedNotices || 0,
          activeUsers: userMetrics.summary.activeUsers || 0,
          averageResponseTime: performanceData.summary.averageResponseTime || 0,
          securityIncidents: securityMetrics.summary.totalIncidents || 0
        },
        traffic: trafficData,
        content: contentData,
        users: userMetrics,
        performance: performanceData,
        security: securityMetrics,
        trends: await this.calculateTrends(dateRange),
        realTimeMetrics: await this.getRealTimeMetrics()
      };

      // Step 6: Cache the results
      this.setCachedData(cacheKey, dashboardData);

      // Step 7: Log analytics access
      const duration = Date.now() - startTime;
      await logUserAction(context, 'DASHBOARD_ANALYTICS_VIEWED', {
        dateRange: dateRange,
        duration: duration,
        metricsCount: Object.keys(dashboardData).length
      });

      await logPerformance('dashboard_analytics', duration, {
        userId: user.id,
        dateRange: dateRange
      });

      console.log(`✅ Dashboard analytics completed in ${duration}ms`);
      return dashboardData;

    } catch (error) {
      console.error('💥 Dashboard analytics error:', error.message);
      return {
        success: false,
        reason: 'analytics_error',
        message: 'Failed to retrieve dashboard analytics'
      };
    }
  }

  /**
   * Get traffic analytics
   * @param {Object} dateRange - Date range
   * @param {Object} user - Requesting user
   * @returns {Object} - Traffic analytics
   */
  async getTrafficAnalytics(dateRange, user) {
    try {
      console.log('🚗 Getting traffic analytics');

      // Daily visits query
      const dailyVisitsQuery = `
        SELECT 
          DATE(visit_time) as date,
          COUNT(*) as visits,
          COUNT(DISTINCT session_id) as unique_visitors,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM site_visits 
        WHERE visit_time >= ? AND visit_time <= ?
        GROUP BY DATE(visit_time)
        ORDER BY date ASC
      `;

      const dailyVisitsResult = await secureDatabase.executeQuery(dailyVisitsQuery, [
        dateRange.start, dateRange.end
      ]);

      // Top pages query
      const topPagesQuery = `
        SELECT 
          COALESCE(n.title, 'Homepage') as page_title,
          n.slug,
          COUNT(*) as visits,
          COUNT(DISTINCT sv.session_id) as unique_visitors
        FROM site_visits sv
        LEFT JOIN notices n ON sv.notice_id = n.id
        WHERE sv.visit_time >= ? AND sv.visit_time <= ?
        GROUP BY sv.notice_id, n.title, n.slug
        ORDER BY visits DESC
        LIMIT 10
      `;

      const topPagesResult = await secureDatabase.executeQuery(topPagesQuery, [
        dateRange.start, dateRange.end
      ]);

      // Traffic sources query
      const trafficSourcesQuery = `
        SELECT 
          CASE 
            WHEN referer IS NULL OR referer = '' THEN 'Direct'
            WHEN referer LIKE '%google%' THEN 'Google'
            WHEN referer LIKE '%facebook%' THEN 'Facebook'
            WHEN referer LIKE '%twitter%' THEN 'Twitter'
            ELSE 'Other'
          END as source,
          COUNT(*) as visits,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM site_visits 
        WHERE visit_time >= ? AND visit_time <= ?
        GROUP BY source
        ORDER BY visits DESC
      `;

      const trafficSourcesResult = await secureDatabase.executeQuery(trafficSourcesQuery, [
        dateRange.start, dateRange.end
      ]);

      // Geographic data query
      const geographicQuery = `
        SELECT 
          country,
          city,
          COUNT(*) as visits,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM site_visits 
        WHERE visit_time >= ? AND visit_time <= ?
          AND country IS NOT NULL
        GROUP BY country, city
        ORDER BY visits DESC
        LIMIT 20
      `;

      const geographicResult = await secureDatabase.executeQuery(geographicQuery, [
        dateRange.start, dateRange.end
      ]);

      // Calculate summary metrics
      const totalVisits = dailyVisitsResult.rows.reduce((sum, row) => sum + row.visits, 0);
      const totalUniqueVisitors = new Set(
        dailyVisitsResult.rows.map(row => row.unique_visitors)
      ).size;

      return {
        summary: {
          totalVisits,
          uniqueVisitors: totalUniqueVisitors,
          averageVisitsPerDay: Math.round(totalVisits / Math.max(dailyVisitsResult.rows.length, 1)),
          peakDay: dailyVisitsResult.rows.reduce((max, row) => 
            row.visits > max.visits ? row : max, 
            { visits: 0, date: null }
          )
        },
        dailyData: dailyVisitsResult.rows,
        topPages: topPagesResult.rows,
        trafficSources: trafficSourcesResult.rows,
        geographic: geographicResult.rows
      };

    } catch (error) {
      console.error('💥 Traffic analytics error:', error.message);
      return {
        summary: { totalVisits: 0, uniqueVisitors: 0 },
        dailyData: [],
        topPages: [],
        trafficSources: [],
        geographic: []
      };
    }
  }

  /**
   * Get content analytics
   * @param {Object} dateRange - Date range
   * @param {Object} user - Requesting user
   * @returns {Object} - Content analytics
   */
  async getContentAnalytics(dateRange, user) {
    try {
      console.log('📝 Getting content analytics');

      // Notice performance query
      const noticePerformanceQuery = `
        SELECT 
          n.id,
          n.title,
          n.slug,
          n.priority,
          n.status,
          n.published_at,
          n.created_at,
          u.username as author,
          COUNT(sv.id) as total_views,
          COUNT(DISTINCT sv.session_id) as unique_viewers,
          COUNT(DISTINCT sv.ip_address) as unique_ips,
          AVG(CASE WHEN sv.visit_time IS NOT NULL THEN 1 ELSE 0 END) as engagement_rate
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        LEFT JOIN site_visits sv ON n.id = sv.notice_id 
          AND sv.visit_time >= ? AND sv.visit_time <= ?
        WHERE n.created_at >= DATE_SUB(?, INTERVAL 6 MONTH)
        GROUP BY n.id, n.title, n.slug, n.priority, n.status, n.published_at, n.created_at, u.username
        ORDER BY total_views DESC
        LIMIT 20
      `;

      const noticePerformanceResult = await secureDatabase.executeQuery(noticePerformanceQuery, [
        dateRange.start, dateRange.end, dateRange.end
      ]);

      // Content trends query
      const contentTrendsQuery = `
        SELECT 
          DATE(n.published_at) as date,
          COUNT(*) as published_count,
          COUNT(DISTINCT n.created_by) as unique_authors
        FROM notices n
        WHERE n.published_at >= ? AND n.published_at <= ?
          AND n.status = 'published'
        GROUP BY DATE(n.published_at)
        ORDER BY date ASC
      `;

      const contentTrendsResult = await secureDatabase.executeQuery(contentTrendsQuery, [
        dateRange.start, dateRange.end
      ]);

      // Priority distribution query
      const priorityDistributionQuery = `
        SELECT 
          priority,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
        FROM notices
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY priority
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END
      `;

      const priorityDistributionResult = await secureDatabase.executeQuery(priorityDistributionQuery, [
        dateRange.start, dateRange.end
      ]);

      // Author productivity query
      const authorProductivityQuery = `
        SELECT 
          u.username,
          u.full_name,
          COUNT(n.id) as total_notices,
          COUNT(CASE WHEN n.status = 'published' THEN 1 END) as published_notices,
          AVG(COALESCE(stats.view_count, 0)) as avg_views
        FROM users u
        LEFT JOIN notices n ON u.id = n.created_by 
          AND n.created_at >= ? AND n.created_at <= ?
        LEFT JOIN (
          SELECT 
            notice_id,
            COUNT(*) as view_count
          FROM site_visits
          WHERE visit_time >= ? AND visit_time <= ?
          GROUP BY notice_id
        ) stats ON n.id = stats.notice_id
        WHERE u.role IN ('admin', 'super_admin')
        GROUP BY u.id, u.username, u.full_name
        HAVING total_notices > 0
        ORDER BY published_notices DESC, avg_views DESC
        LIMIT 10
      `;

      const authorProductivityResult = await secureDatabase.executeQuery(authorProductivityQuery, [
        dateRange.start, dateRange.end, dateRange.start, dateRange.end
      ]);

      // Calculate summary metrics
      const totalNotices = noticePerformanceResult.rows.length;
      const publishedNotices = noticePerformanceResult.rows.filter(n => n.status === 'published').length;
      const totalViews = noticePerformanceResult.rows.reduce((sum, row) => sum + (row.total_views || 0), 0);

      return {
        summary: {
          totalNotices,
          publishedNotices,
          draftNotices: totalNotices - publishedNotices,
          totalViews,
          averageViewsPerNotice: Math.round(totalViews / Math.max(totalNotices, 1))
        },
        noticePerformance: noticePerformanceResult.rows,
        contentTrends: contentTrendsResult.rows,
        priorityDistribution: priorityDistributionResult.rows,
        authorProductivity: authorProductivityResult.rows
      };

    } catch (error) {
      console.error('💥 Content analytics error:', error.message);
      return {
        summary: { totalNotices: 0, publishedNotices: 0, totalViews: 0 },
        noticePerformance: [],
        contentTrends: [],
        priorityDistribution: [],
        authorProductivity: []
      };
    }
  }

  /**
   * Get user analytics
   * @param {Object} dateRange - Date range
   * @param {Object} user - Requesting user
   * @returns {Object} - User analytics
   */
  async getUserAnalytics(dateRange, user) {
    try {
      console.log('👥 Getting user analytics');

      // Check if user can view detailed user analytics
      if (!user.isSuperAdmin()) {
        return {
          summary: { message: 'Detailed user analytics require super admin privileges' },
          userActivity: [],
          sessionMetrics: [],
          roleDistribution: []
        };
      }

      // User activity query
      const userActivityQuery = `
        SELECT 
          u.id,
          u.username,
          u.full_name,
          u.role,
          u.created_at as registration_date,
          COUNT(DISTINCT s.id) as total_sessions,
          MAX(s.last_activity) as last_login,
          COUNT(DISTINCT n.id) as notices_created,
          COUNT(CASE WHEN n.status = 'published' THEN 1 END) as notices_published
        FROM users u
        LEFT JOIN user_sessions s ON u.id = s.user_id 
          AND s.created_at >= ? AND s.created_at <= ?
        LEFT JOIN notices n ON u.id = n.created_by 
          AND n.created_at >= ? AND n.created_at <= ?
        GROUP BY u.id, u.username, u.full_name, u.role, u.created_at
        ORDER BY total_sessions DESC, notices_published DESC
        LIMIT 50
      `;

      const userActivityResult = await secureDatabase.executeQuery(userActivityQuery, [
        dateRange.start, dateRange.end, dateRange.start, dateRange.end
      ]);

      // Session metrics query
      const sessionMetricsQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(last_activity, NOW()))) as avg_duration
        FROM user_sessions
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const sessionMetricsResult = await secureDatabase.executeQuery(sessionMetricsQuery, [
        dateRange.start, dateRange.end
      ]);

      // Role distribution query
      const roleDistributionQuery = `
        SELECT 
          role,
          COUNT(*) as user_count,
          COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_users_in_period
        FROM users
        GROUP BY role
        ORDER BY user_count DESC
      `;

      const roleDistributionResult = await secureDatabase.executeQuery(roleDistributionQuery, [
        dateRange.start
      ]);

      // Login trends query
      const loginTrendsQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as login_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM user_sessions
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const loginTrendsResult = await secureDatabase.executeQuery(loginTrendsQuery, [
        dateRange.start, dateRange.end
      ]);

      // Calculate summary metrics
      const totalUsers = userActivityResult.rows.length;
      const activeUsers = userActivityResult.rows.filter(u => u.total_sessions > 0).length;
      const totalSessions = sessionMetricsResult.rows.reduce((sum, row) => sum + row.total_sessions, 0);

      return {
        summary: {
          totalUsers,
          activeUsers,
          totalSessions,
          averageSessionsPerUser: Math.round(totalSessions / Math.max(activeUsers, 1))
        },
        userActivity: userActivityResult.rows,
        sessionMetrics: sessionMetricsResult.rows,
        roleDistribution: roleDistributionResult.rows,
        loginTrends: loginTrendsResult.rows
      };

    } catch (error) {
      console.error('💥 User analytics error:', error.message);
      return {
        summary: { totalUsers: 0, activeUsers: 0, totalSessions: 0 },
        userActivity: [],
        sessionMetrics: [],
        roleDistribution: [],
        loginTrends: []
      };
    }
  }

  /**
   * Get performance analytics
   * @param {Object} dateRange - Date range
   * @param {Object} user - Requesting user
   * @returns {Object} - Performance analytics
   */
  async getPerformanceAnalytics(dateRange, user) {
    try {
      console.log('⚡ Getting performance analytics');

      // For now, return mock performance data
      // In a real implementation, you'd collect this from your monitoring system
      const performanceData = {
        summary: {
          averageResponseTime: Math.round(Math.random() * 200 + 100), // 100-300ms
          errorRate: Math.round(Math.random() * 5 * 100) / 100, // 0-5%
          throughput: Math.round(Math.random() * 1000 + 500), // 500-1500 req/min
          uptime: 99.9
        },
        responseTimesTrend: this.generateMockTimeSeries(dateRange, 'response_time'),
        errorRatesTrend: this.generateMockTimeSeries(dateRange, 'error_rate'),
        throughputTrend: this.generateMockTimeSeries(dateRange, 'throughput'),
        slowestEndpoints: [
          { endpoint: '/api/analytics/dashboard', avgTime: 245, calls: 156 },
          { endpoint: '/api/notices/search', avgTime: 189, calls: 342 },
          { endpoint: '/api/upload/files', avgTime: 167, calls: 89 }
        ]
      };

      return performanceData;

    } catch (error) {
      console.error('💥 Performance analytics error:', error.message);
      return {
        summary: { averageResponseTime: 0, errorRate: 0, throughput: 0, uptime: 0 },
        responseTimesTrend: [],
        errorRatesTrend: [],
        throughputTrend: [],
        slowestEndpoints: []
      };
    }
  }

  /**
   * Get security analytics
   * @param {Object} dateRange - Date range
   * @param {Object} user - Requesting user
   * @returns {Object} - Security analytics
   */
  async getSecurityAnalytics(dateRange, user) {
    try {
      console.log('🔒 Getting security analytics');

      // Check permissions for security analytics
      if (!user.isSuperAdmin()) {
        return {
          summary: { message: 'Security analytics require super admin privileges' },
          securityEvents: [],
          suspiciousActivity: [],
          failedLogins: []
        };
      }

      // Mock security data for demonstration
      // In a real implementation, you'd query your security logs
      const securityData = {
        summary: {
          totalIncidents: Math.round(Math.random() * 20),
          failedLogins: Math.round(Math.random() * 50),
          blockedIPs: Math.round(Math.random() * 10),
          suspiciousActivities: Math.round(Math.random() * 15)
        },
        incidentTrend: this.generateMockTimeSeries(dateRange, 'security_incidents'),
        topThreats: [
          { type: 'SQL Injection Attempt', count: 23, severity: 'high' },
          { type: 'XSS Attempt', count: 15, severity: 'medium' },
          { type: 'Rate Limit Exceeded', count: 67, severity: 'low' }
        ],
        suspiciousIPs: [
          { ip: '192.168.1.100', attempts: 45, lastSeen: '2025-06-24T15:30:00Z' },
          { ip: '10.0.0.50', attempts: 23, lastSeen: '2025-06-24T14:45:00Z' }
        ]
      };

      return securityData;

    } catch (error) {
      console.error('💥 Security analytics error:', error.message);
      return {
        summary: { totalIncidents: 0, failedLogins: 0, blockedIPs: 0 },
        incidentTrend: [],
        topThreats: [],
        suspiciousIPs: []
      };
    }
  }

  /**
   * Get real-time metrics
   * @returns {Object} - Real-time metrics
   */
  async getRealTimeMetrics() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - this.config.realTimeThreshold);

      // Real-time visitors query
      const realTimeQuery = `
        SELECT 
          COUNT(DISTINCT session_id) as current_visitors,
          COUNT(*) as recent_pageviews
        FROM site_visits
        WHERE visit_time >= ?
      `;

      const realTimeResult = await secureDatabase.executeQuery(realTimeQuery, [fiveMinutesAgo]);

      // Active sessions query
      const activeSessionsQuery = `
        SELECT COUNT(*) as active_sessions
        FROM user_sessions
        WHERE is_active = TRUE 
          AND last_activity >= ?
      `;

      const activeSessionsResult = await secureDatabase.executeQuery(activeSessionsQuery, [fiveMinutesAgo]);

      return {
        currentVisitors: realTimeResult.rows[0]?.current_visitors || 0,
        recentPageviews: realTimeResult.rows[0]?.recent_pageviews || 0,
        activeSessions: activeSessionsResult.rows[0]?.active_sessions || 0,
        timestamp: now.toISOString()
      };

    } catch (error) {
      console.error('💥 Real-time metrics error:', error.message);
      return {
        currentVisitors: 0,
        recentPageviews: 0,
        activeSessions: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate trends between periods
   * @param {Object} dateRange - Date range
   * @returns {Object} - Trend calculations
   */
  async calculateTrends(dateRange) {
    try {
      // Calculate previous period for comparison
      const periodLength = new Date(dateRange.end) - new Date(dateRange.start);
      const previousStart = new Date(new Date(dateRange.start) - periodLength);
      const previousEnd = new Date(dateRange.start);

      // Get current period metrics
      const currentMetrics = await this.getPeriodMetrics(dateRange);
      const previousMetrics = await this.getPeriodMetrics({ 
        start: previousStart, 
        end: previousEnd 
      });

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        visitors: {
          current: currentMetrics.visitors,
          previous: previousMetrics.visitors,
          change: calculateChange(currentMetrics.visitors, previousMetrics.visitors)
        },
        pageviews: {
          current: currentMetrics.pageviews,
          previous: previousMetrics.pageviews,
          change: calculateChange(currentMetrics.pageviews, previousMetrics.pageviews)
        },
        notices: {
          current: currentMetrics.notices,
          previous: previousMetrics.notices,
          change: calculateChange(currentMetrics.notices, previousMetrics.notices)
        }
      };

    } catch (error) {
      console.error('💥 Trend calculation error:', error.message);
      return {
        visitors: { current: 0, previous: 0, change: 0 },
        pageviews: { current: 0, previous: 0, change: 0 },
        notices: { current: 0, previous: 0, change: 0 }
      };
    }
  }

  /**
   * Get metrics for a specific period
   * @param {Object} dateRange - Date range
   * @returns {Object} - Period metrics
   */
  async getPeriodMetrics(dateRange) {
    try {
      const metricsQuery = `
        SELECT 
          (SELECT COUNT(DISTINCT session_id) FROM site_visits WHERE visit_time >= ? AND visit_time <= ?) as visitors,
          (SELECT COUNT(*) FROM site_visits WHERE visit_time >= ? AND visit_time <= ?) as pageviews,
          (SELECT COUNT(*) FROM notices WHERE created_at >= ? AND created_at <= ?) as notices
      `;

      const result = await secureDatabase.executeQuery(metricsQuery, [
        dateRange.start, dateRange.end,
        dateRange.start, dateRange.end,
        dateRange.start, dateRange.end
      ]);

      return result.rows[0] || { visitors: 0, pageviews: 0, notices: 0 };

    } catch (error) {
      console.error('💥 Period metrics error:', error.message);
      return { visitors: 0, pageviews: 0, notices: 0 };
    }
  }

  /**
   * Export analytics data
   * @param {Object} options - Export options
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - Export result
   */
  async exportAnalyticsData(options = {}, user, context = {}) {
    try {
      console.log(`📤 Exporting analytics data for ${user.username}`);

      // Step 1: Validate permissions
      const permissionCheck = await this.checkAnalyticsPermissions(user, 'export');
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 2: Validate export options
      const { type, format, startDate, endDate, limit } = options;

      if (!this.config.supportedExportFormats.includes(format)) {
        return {
          success: false,
          reason: 'invalid_format',
          message: `Format must be one of: ${this.config.supportedExportFormats.join(', ')}`
        };
      }

      // Step 3: Get data based on type
      let exportData;
      switch (type) {
        case 'visits':
          exportData = await this.exportVisitsData(startDate, endDate, limit);
          break;
        case 'notices':
          exportData = await this.exportNoticesData(startDate, endDate, limit);
          break;
        case 'users':
          exportData = await this.exportUsersData(startDate, endDate, limit);
          break;
        default:
          return {
            success: false,
            reason: 'invalid_type',
            message: 'Export type must be visits, notices, or users'
          };
      }

      // Step 4: Format data
      const formattedData = await this.formatExportData(exportData, format);

      // Step 5: Log export
      await logUserAction(context, 'ANALYTICS_EXPORTED', {
        exportType: type,
        format: format,
        recordCount: exportData.length,
        dateRange: { startDate, endDate }
      });

      return {
        success: true,
        data: formattedData,
        metadata: {
          type,
          format,
          recordCount: exportData.length,
          exportedAt: new Date().toISOString(),
          exportedBy: user.username
        }
      };

    } catch (error) {
      console.error('💥 Analytics export error:', error.message);
      return {
        success: false,
        reason: 'export_error',
        message: 'Failed to export analytics data'
      };
    }
  }

  /**
   * Check analytics permissions
   * @param {Object} user - User object
   * @param {string} operation - Operation type
   * @returns {Object} - Permission check result
   */
  async checkAnalyticsPermissions(user, operation) {
    try {
      // Super admin can do everything
      if (user.isSuperAdmin()) {
        return { allowed: true };
      }

      // Regular admin can view basic analytics
      if (user.isAdmin()) {
        const allowedOperations = ['dashboard', 'basic'];
        if (allowedOperations.includes(operation)) {
          return { allowed: true };
        }

        return {
          allowed: false,
          success: false,
          reason: 'insufficient_permissions',
          message: 'This operation requires super admin privileges'
        };
      }

      // Non-admin users cannot access analytics
      return {
        allowed: false,
        success: false,
        reason: 'access_denied',
        message: 'Analytics access requires admin privileges'
      };

    } catch (error) {
      console.error('💥 Permission check error:', error.message);
      return {
        allowed: false,
        success: false,
        reason: 'permission_check_error',
        message: 'Failed to check permissions'
      };
    }
  }

  /**
   * Parse date range from options
   * @param {Object} options - Options object
   * @returns {Object} - Parsed date range
   */
  parseDateRange(options) {
    try {
      const now = new Date();
      let start, end;

      if (options.startDate && options.endDate) {
        start = new Date(options.startDate);
        end = new Date(options.endDate);
      } else {
        // Default to last 30 days
        end = now;
        start = new Date(now.getTime() - (this.config.defaultDateRange * 24 * 60 * 60 * 1000));
      }

      // Validate date range
      const maxRange = this.config.maxDateRange * 24 * 60 * 60 * 1000;
      if (end - start > maxRange) {
        start = new Date(end.getTime() - maxRange);
      }

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        days: Math.ceil((end - start) / (24 * 60 * 60 * 1000))
      };

    } catch (error) {
      console.error('💥 Date range parsing error:', error.message);
      const now = new Date();
      const defaultStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      return {
        start: defaultStart.toISOString(),
        end: now.toISOString(),
        days: 30
      };
    }
  }

  /**
   * Get cached analytics data
   * @param {string} key - Cache key
   * @returns {Object|null} - Cached data or null
   */
  getCachedData(key) {
    try {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set cached analytics data
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  setCachedData(key, data) {
    try {
      this.cache.set(key, {
        data: data,
        timestamp: Date.now()
      });

      // Clean old cache entries
      if (this.cache.size > 100) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
    } catch (error) {
      console.error('💥 Cache setting error:', error.message);
    }
  }

  /**
   * Generate mock time series data
   * @param {Object} dateRange - Date range
   * @param {string} type - Data type
   * @returns {Array} - Mock time series data
   */
  generateMockTimeSeries(dateRange, type) {
    try {
      const data = [];
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));

      for (let i = 0; i < days; i++) {
        const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
        let value;

        switch (type) {
          case 'response_time':
            value = Math.round(Math.random() * 100 + 150); // 150-250ms
            break;
          case 'error_rate':
            value = Math.round(Math.random() * 3 * 100) / 100; // 0-3%
            break;
          case 'throughput':
            value = Math.round(Math.random() * 500 + 800); // 800-1300 req/min
            break;
          case 'security_incidents':
            value = Math.round(Math.random() * 5); // 0-5 incidents
            break;
          default:
            value = Math.round(Math.random() * 100);
        }

        data.push({
          date: date.toISOString().split('T')[0],
          value: value
        });
      }

      return data;
    } catch (error) {
      console.error('💥 Mock data generation error:', error.message);
      return [];
    }
  }

  /**
   * Export visits data
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {number} limit - Record limit
   * @returns {Array} - Visits data
   */
  async exportVisitsData(startDate, endDate, limit = 10000) {
    try {
      const query = `
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
        WHERE sv.visit_time >= ? AND sv.visit_time <= ?
        ORDER BY sv.visit_time DESC
        LIMIT ?
      `;

      const result = await secureDatabase.executeQuery(query, [startDate, endDate, limit]);
      return result.rows || [];

    } catch (error) {
      console.error('💥 Visits export error:', error.message);
      return [];
    }
  }

  /**
   * Export notices data
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {number} limit - Record limit
   * @returns {Array} - Notices data
   */
  async exportNoticesData(startDate, endDate, limit = 10000) {
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
        WHERE n.created_at >= ? AND n.created_at <= ?
        GROUP BY n.id, n.title, n.slug, n.status, n.priority, n.created_at, n.published_at, u.username
        ORDER BY n.created_at DESC
        LIMIT ?
      `;

      const result = await secureDatabase.executeQuery(query, [startDate, endDate, limit]);
      return result.rows || [];

    } catch (error) {
      console.error('💥 Notices export error:', error.message);
      return [];
    }
  }

  /**
   * Export users data
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {number} limit - Record limit
   * @returns {Array} - Users data
   */
  async exportUsersData(startDate, endDate, limit = 10000) {
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
        WHERE u.created_at >= ? AND u.created_at <= ?
        GROUP BY u.id, u.username, u.email, u.role, u.full_name, u.created_at
        ORDER BY u.created_at DESC
        LIMIT ?
      `;

      const result = await secureDatabase.executeQuery(query, [startDate, endDate, limit]);
      return result.rows || [];

    } catch (error) {
      console.error('💥 Users export error:', error.message);
      return [];
    }
  }

  /**
   * Format export data
   * @param {Array} data - Raw data
   * @param {string} format - Export format
   * @returns {string|Object} - Formatted data
   */
  async formatExportData(data, format) {
    try {
      switch (format) {
        case 'json':
          return JSON.stringify(data, null, 2);
          
        case 'csv':
          return this.convertToCSV(data);
          
        case 'xlsx':
          // In a real implementation, you'd use a library like 'xlsx'
          return { message: 'XLSX export not implemented in demo' };
          
        default:
          return data;
      }
    } catch (error) {
      console.error('💥 Data formatting error:', error.message);
      return data;
    }
  }

  /**
   * Convert data to CSV format
   * @param {Array} data - Data to convert
   * @returns {string} - CSV string
   */
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
      console.error('💥 CSV conversion error:', error.message);
      return 'Error converting data to CSV';
    }
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

module.exports = analyticsService;