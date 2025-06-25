// Site Visit Analytics Model - Anonymous visitor tracking
const secureDatabase = require('../config/database');
const { logSecurityEvent } = require('../middleware/logging');

class SiteVisit {
  constructor(visitData = {}) {
    this.id = visitData.id || null;
    this.noticeId = visitData.notice_id || visitData.noticeId || null;
    this.ipAddress = visitData.ip_address || visitData.ipAddress || null;
    this.userAgent = visitData.user_agent || visitData.userAgent || null;
    this.referer = visitData.referer || null;
    this.visitDate = visitData.visit_date || visitData.visitDate || null;
    this.visitTime = visitData.visit_time || visitData.visitTime || null;
    this.sessionId = visitData.session_id || visitData.sessionId || null;
    this.country = visitData.country || null;
    this.city = visitData.city || null;
    
    // Analytics properties
    this.noticeTitle = visitData.notice_title || null;
    this.visitCount = visitData.visit_count || 0;
    this.uniqueVisitors = visitData.unique_visitors || 0;
  }

  // Static method to record a visit
  static async recordVisit(visitData) {
    try {
      // Validate required fields
      if (!visitData.ipAddress || !visitData.sessionId) {
        throw new Error('IP address and session ID are required');
      }

      // Sanitize IP address
      const ipAddress = visitData.ipAddress.substring(0, 45);
      const sessionId = visitData.sessionId.substring(0, 100);
      const userAgent = visitData.userAgent ? visitData.userAgent.substring(0, 1000) : null;
      const referer = visitData.referer ? visitData.referer.substring(0, 500) : null;

      // Check if this is a duplicate visit (same session, same notice, within 5 minutes)
      const isDuplicate = await SiteVisit.isDuplicateVisit(
        sessionId, 
        visitData.noticeId, 
        5 // minutes
      );

      if (isDuplicate) {
        console.log('📊 Skipping duplicate visit recording');
        return null;
      }

      // Insert visit record
      const query = `
        INSERT INTO site_visits (notice_id, ip_address, user_agent, referer, visit_date, session_id, country, city)
        VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)
      `;

      const result = await secureDatabase.executeQuery(query, [
        visitData.noticeId || null,
        ipAddress,
        userAgent,
        referer,
        sessionId,
        visitData.country || null,
        visitData.city || null
      ]);

      if (!result.insertId) {
        throw new Error('Failed to record visit');
      }

      console.log(`📊 Visit recorded: ${visitData.noticeId ? `Notice ${visitData.noticeId}` : 'Homepage'} from ${ipAddress}`);

      // Return the recorded visit
      return await SiteVisit.findById(result.insertId);
    } catch (error) {
      console.error('💥 Error recording visit:', error.message);
      throw error;
    }
  }

  // Check if visit is a duplicate
  static async isDuplicateVisit(sessionId, noticeId = null, withinMinutes = 5) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM site_visits
        WHERE session_id = ? 
          AND (? IS NULL OR notice_id = ?)
          AND visit_time >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      `;

      const result = await secureDatabase.executeQuery(query, [
        sessionId,
        noticeId,
        noticeId,
        withinMinutes
      ]);

      return result.rows[0].count > 0;
    } catch (error) {
      console.error('💥 Error checking duplicate visit:', error.message);
      return false; // If error, allow the visit to be recorded
    }
  }

  // Static method to find visit by ID
  static async findById(id) {
    try {
      if (!id || isNaN(parseInt(id))) {
        throw new Error('Invalid visit ID');
      }

      const query = `
        SELECT sv.*, n.title as notice_title
        FROM site_visits sv
        LEFT JOIN notices n ON sv.notice_id = n.id
        WHERE sv.id = ?
        LIMIT 1
      `;

      const result = await secureDatabase.executeQuery(query, [parseInt(id)]);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new SiteVisit(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding visit by ID:', error.message);
      throw new Error('Failed to find visit');
    }
  }

  // Get analytics for a specific notice
  static async getNoticeAnalytics(noticeId, options = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        groupBy = 'day' // day, week, month
      } = options;

      if (!noticeId || isNaN(parseInt(noticeId))) {
        throw new Error('Invalid notice ID');
      }

      // Base query for notice analytics
      let query = `
        SELECT 
          COUNT(*) as total_visits,
          COUNT(DISTINCT session_id) as unique_visitors,
          COUNT(DISTINCT ip_address) as unique_ips,
          DATE(visit_time) as visit_date
        FROM site_visits 
        WHERE notice_id = ?
      `;
      
      const params = [parseInt(noticeId)];

      // Add date filters
      if (startDate) {
        query += ` AND DATE(visit_time) >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(visit_time) <= ?`;
        params.push(endDate);
      }

      // Group by time period
      switch (groupBy) {
        case 'week':
          query += ` GROUP BY YEARWEEK(visit_time, 1) ORDER BY visit_date DESC`;
          break;
        case 'month':
          query += ` GROUP BY YEAR(visit_time), MONTH(visit_time) ORDER BY visit_date DESC`;
          break;
        default: // day
          query += ` GROUP BY DATE(visit_time) ORDER BY visit_date DESC`;
      }

      query += ` LIMIT 30`; // Limit to 30 periods

      const result = await secureDatabase.executeQuery(query, params);

      // Get overall stats
      const overallQuery = `
        SELECT 
          COUNT(*) as total_visits,
          COUNT(DISTINCT session_id) as unique_visitors,
          COUNT(DISTINCT ip_address) as unique_ips,
          MIN(visit_time) as first_visit,
          MAX(visit_time) as last_visit
        FROM site_visits 
        WHERE notice_id = ?
      `;

      const overallResult = await secureDatabase.executeQuery(overallQuery, [parseInt(noticeId)]);

      return {
        noticeId: parseInt(noticeId),
        overall: overallResult.rows[0] || {},
        timeline: result.rows || [],
        period: groupBy
      };
    } catch (error) {
      console.error('💥 Error getting notice analytics:', error.message);
      throw error;
    }
  }

  // Get general site analytics
  static async getSiteAnalytics(options = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        limit = 30
      } = options;

      // Build date filter
      let dateFilter = '';
      const params = [];

      if (startDate) {
        dateFilter += ` AND DATE(visit_time) >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        dateFilter += ` AND DATE(visit_time) <= ?`;
        params.push(endDate);
      }

      // Daily analytics
      const dailyQuery = `
        SELECT 
          DATE(visit_time) as date,
          COUNT(*) as total_visits,
          COUNT(DISTINCT session_id) as unique_visitors,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(CASE WHEN notice_id IS NULL THEN 1 END) as homepage_visits,
          COUNT(CASE WHEN notice_id IS NOT NULL THEN 1 END) as notice_visits
        FROM site_visits 
        WHERE 1=1 ${dateFilter}
        GROUP BY DATE(visit_time)
        ORDER BY date DESC
        LIMIT ?
      `;

      const dailyResult = await secureDatabase.executeQuery(dailyQuery, [...params, Math.min(365, limit)]);

      // Top notices
      const topNoticesQuery = `
        SELECT 
          n.id,
          n.title,
          n.slug,
          COUNT(sv.id) as visit_count,
          COUNT(DISTINCT sv.session_id) as unique_visitors
        FROM site_visits sv
        JOIN notices n ON sv.notice_id = n.id
        WHERE 1=1 ${dateFilter}
        GROUP BY n.id, n.title, n.slug
        ORDER BY visit_count DESC
        LIMIT 10
      `;

      const topNoticesResult = await secureDatabase.executeQuery(topNoticesQuery, params);

      // Referrer stats
      const referrerQuery = `
        SELECT 
          CASE 
            WHEN referer IS NULL OR referer = '' THEN 'Direct'
            WHEN referer LIKE '%google.%' THEN 'Google'
            WHEN referer LIKE '%facebook.%' THEN 'Facebook'
            WHEN referer LIKE '%twitter.%' THEN 'Twitter'
            WHEN referer LIKE '%linkedin.%' THEN 'LinkedIn'
            ELSE 'Other'
          END as source,
          COUNT(*) as visit_count,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM site_visits
        WHERE 1=1 ${dateFilter}
        GROUP BY source
        ORDER BY visit_count DESC
        LIMIT 10
      `;

      const referrerResult = await secureDatabase.executeQuery(referrerQuery, params);

      // Overall stats
      const overallQuery = `
        SELECT 
          COUNT(*) as total_visits,
          COUNT(DISTINCT session_id) as unique_visitors,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(CASE WHEN notice_id IS NULL THEN 1 END) as homepage_visits,
          COUNT(CASE WHEN notice_id IS NOT NULL THEN 1 END) as notice_visits,
          COUNT(DISTINCT notice_id) as notices_viewed
        FROM site_visits
        WHERE 1=1 ${dateFilter}
      `;

      const overallResult = await secureDatabase.executeQuery(overallQuery, params);

      return {
        period: {
          startDate: startDate || 'all-time',
          endDate: endDate || 'current'
        },
        overall: overallResult.rows[0] || {},
        daily: dailyResult.rows || [],
        topNotices: topNoticesResult.rows || [],
        referrers: referrerResult.rows || []
      };
    } catch (error) {
      console.error('💥 Error getting site analytics:', error.message);
      throw error;
    }
  }

  // Get visitor statistics
  static async getVisitorStats(options = {}) {
    try {
      const {
        startDate = null,
        endDate = null
      } = options;

      let dateFilter = '';
      const params = [];

      if (startDate) {
        dateFilter += ` AND DATE(visit_time) >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        dateFilter += ` AND DATE(visit_time) <= ?`;
        params.push(endDate);
      }

      // Geographic stats (if available)
      const geoQuery = `
        SELECT 
          country,
          city,
          COUNT(*) as visit_count,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM site_visits
        WHERE country IS NOT NULL ${dateFilter}
        GROUP BY country, city
        ORDER BY visit_count DESC
        LIMIT 20
      `;

      const geoResult = await secureDatabase.executeQuery(geoQuery, params);

      // Browser/OS stats (simplified from user agent)
      const browserQuery = `
        SELECT 
          CASE 
            WHEN user_agent LIKE '%Chrome%' THEN 'Chrome'
            WHEN user_agent LIKE '%Firefox%' THEN 'Firefox'
            WHEN user_agent LIKE '%Safari%' AND user_agent NOT LIKE '%Chrome%' THEN 'Safari'
            WHEN user_agent LIKE '%Edge%' THEN 'Edge'
            ELSE 'Other'
          END as browser,
          COUNT(*) as visit_count,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM site_visits
        WHERE user_agent IS NOT NULL ${dateFilter}
        GROUP BY browser
        ORDER BY visit_count DESC
      `;

      const browserResult = await secureDatabase.executeQuery(browserQuery, params);

      return {
        geographic: geoResult.rows || [],
        browsers: browserResult.rows || []
      };
    } catch (error) {
      console.error('💥 Error getting visitor stats:', error.message);
      throw error;
    }
  }

  // Clean up old visit data
  static async cleanupOldVisits(daysToKeep = 365) {
    try {
      const query = `
        DELETE FROM site_visits 
        WHERE visit_time < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;

      const result = await secureDatabase.executeQuery(query, [daysToKeep]);

      console.log(`🧹 Cleaned up ${result.affectedRows} old visit records (older than ${daysToKeep} days)`);

      return result.affectedRows;
    } catch (error) {
      console.error('💥 Error cleaning up old visits:', error.message);
      throw error;
    }
  }

  // Detect suspicious activity
  static async detectSuspiciousActivity(ipAddress, timeWindow = 60) {
    try {
      const query = `
        SELECT COUNT(*) as visit_count
        FROM site_visits
        WHERE ip_address = ?
          AND visit_time >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      `;

      const result = await secureDatabase.executeQuery(query, [ipAddress, timeWindow]);
      const visitCount = result.rows[0].visit_count;

      // Flag as suspicious if more than 50 visits in the time window
      if (visitCount > 50) {
        logSecurityEvent(
          { ip: ipAddress },
          'SUSPICIOUS_ACTIVITY',
          {
            type: 'HIGH_VISIT_FREQUENCY',
            visitCount,
            timeWindow,
            severity: 'medium',
            description: `IP ${ipAddress} made ${visitCount} visits in ${timeWindow} minutes`
          }
        );

        return {
          suspicious: true,
          visitCount,
          reason: 'High visit frequency'
        };
      }

      return {
        suspicious: false,
        visitCount
      };
    } catch (error) {
      console.error('💥 Error detecting suspicious activity:', error.message);
      return { suspicious: false, error: error.message };
    }
  }

  // Get analytics dashboard data
  static async getDashboardData() {
    try {
      // Get data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      // Get site analytics
      const siteAnalytics = await SiteVisit.getSiteAnalytics({ startDate, limit: 30 });

      // Get today's stats
      const todayQuery = `
        SELECT 
          COUNT(*) as today_visits,
          COUNT(DISTINCT session_id) as today_visitors
        FROM site_visits
        WHERE DATE(visit_time) = CURDATE()
      `;

      const todayResult = await secureDatabase.executeQuery(todayQuery);

      // Get this week's stats
      const weekQuery = `
        SELECT 
          COUNT(*) as week_visits,
          COUNT(DISTINCT session_id) as week_visitors
        FROM site_visits
        WHERE YEARWEEK(visit_time, 1) = YEARWEEK(NOW(), 1)
      `;

      const weekResult = await secureDatabase.executeQuery(weekQuery);

      return {
        ...siteAnalytics,
        today: todayResult.rows[0] || { today_visits: 0, today_visitors: 0 },
        thisWeek: weekResult.rows[0] || { week_visits: 0, week_visitors: 0 }
      };
    } catch (error) {
      console.error('💥 Error getting dashboard data:', error.message);
      throw error;
    }
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      noticeId: this.noticeId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      referer: this.referer,
      visitDate: this.visitDate,
      visitTime: this.visitTime,
      sessionId: this.sessionId,
      country: this.country,
      city: this.city,
      noticeTitle: this.noticeTitle
    };
  }
}

module.exports = SiteVisit;