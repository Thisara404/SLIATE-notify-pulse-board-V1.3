// User Session Model - JWT session tracking and management
const crypto = require('crypto');
const secureDatabase = require('../config/database');
const { logSecurityEvent } = require('../middleware/logging');

class UserSession {
  constructor(sessionData = {}) {
    this.id = sessionData.id || null;
    this.userId = sessionData.user_id || sessionData.userId || null;
    this.tokenHash = sessionData.token_hash || sessionData.tokenHash || null;
    this.ipAddress = sessionData.ip_address || sessionData.ipAddress || null;
    this.userAgent = sessionData.user_agent || sessionData.userAgent || null;
    this.expiresAt = sessionData.expires_at || sessionData.expiresAt || null;
    this.createdAt = sessionData.created_at || sessionData.createdAt || null;
    this.lastActivity = sessionData.last_activity || sessionData.lastActivity || null;
    this.isActive = sessionData.is_active !== undefined ? sessionData.is_active : true;
    
    // Joined data
    this.username = sessionData.username || null;
    this.userRole = sessionData.user_role || sessionData.role || null;
  }

  // Static method to create new session
  static async createSession(userId, token, sessionInfo = {}) {
    try {
      if (!userId || !token) {
        throw new Error('User ID and token are required');
      }

      // Hash the token for security (don't store plaintext JWT)
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Insert session
      const query = `
        INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `;

      const result = await secureDatabase.executeQuery(query, [
        parseInt(userId),
        tokenHash,
        sessionInfo.ipAddress ? sessionInfo.ipAddress.substring(0, 45) : null,
        sessionInfo.userAgent ? sessionInfo.userAgent.substring(0, 1000) : null,
        expiresAt
      ]);

      if (!result.insertId) {
        throw new Error('Failed to create session');
      }

      console.log(`🔐 Session created for user ${userId} from ${sessionInfo.ipAddress}`);

      // Log session creation
      logSecurityEvent(
        { 
          user: { id: userId },
          ip: sessionInfo.ipAddress,
          userAgent: sessionInfo.userAgent
        },
        'SESSION_CREATED',
        {
          sessionId: result.insertId,
          expiresAt: expiresAt.toISOString(),
          severity: 'low'
        }
      );

      return await UserSession.findById(result.insertId);
    } catch (error) {
      console.error('💥 Error creating session:', error.message);
      throw error;
    }
  }

  // Static method to find session by ID
  static async findById(id) {
    try {
      if (!id || isNaN(parseInt(id))) {
        throw new Error('Invalid session ID');
      }

      const query = `
        SELECT s.*, u.username, u.role as user_role
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
        LIMIT 1
      `;

      const result = await secureDatabase.executeQuery(query, [parseInt(id)]);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new UserSession(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding session by ID:', error.message);
      throw new Error('Failed to find session');
    }
  }

  // Static method to find session by token
  static async findByToken(token) {
    try {
      if (!token) {
        throw new Error('Token is required');
      }

      // Hash the token to match stored hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const query = `
        SELECT s.*, u.username, u.role as user_role
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = ? 
          AND s.is_active = TRUE 
          AND s.expires_at > NOW()
        LIMIT 1
      `;

      const result = await secureDatabase.executeQuery(query, [tokenHash]);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const session = new UserSession(result.rows[0]);

      // Update last activity
      await session.updateActivity();

      return session;
    } catch (error) {
      console.error('💥 Error finding session by token:', error.message);
      throw new Error('Failed to find session');
    }
  }

  // Static method to get all sessions for a user
  static async getUserSessions(userId, includeInactive = false) {
    try {
      if (!userId || isNaN(parseInt(userId))) {
        throw new Error('Invalid user ID');
      }

      let query = `
        SELECT s.*, u.username, u.role as user_role
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
      `;

      const params = [parseInt(userId)];

      if (!includeInactive) {
        query += ` AND s.is_active = TRUE AND s.expires_at > NOW()`;
      }

      query += ` ORDER BY s.last_activity DESC`;

      const result = await secureDatabase.executeQuery(query, params);

      return (result.rows || []).map(row => new UserSession(row));
    } catch (error) {
      console.error('💥 Error getting user sessions:', error.message);
      throw error;
    }
  }

  // Instance method to update last activity
  async updateActivity() {
    try {
      if (!this.id) {
        throw new Error('Cannot update activity without session ID');
      }

      const query = `
        UPDATE user_sessions 
        SET last_activity = NOW() 
        WHERE id = ? AND is_active = TRUE
      `;

      await secureDatabase.executeQuery(query, [this.id]);

      this.lastActivity = new Date();
    } catch (error) {
      console.error('💥 Error updating session activity:', error.message);
      // Don't throw error - activity update failure shouldn't break authentication
    }
  }

  // Instance method to revoke session
  async revoke(revokedBy = null) {
    try {
      if (!this.id) {
        throw new Error('Cannot revoke session without ID');
      }

      const query = `
        UPDATE user_sessions 
        SET is_active = FALSE 
        WHERE id = ?
      `;

      const result = await secureDatabase.executeQuery(query, [this.id]);

      if (result.affectedRows === 0) {
        throw new Error('Session not found or already revoked');
      }

      this.isActive = false;

      console.log(`🔒 Session ${this.id} revoked for user ${this.userId}`);

      // Log session revocation
      logSecurityEvent(
        { 
          user: revokedBy || { id: this.userId },
          ip: this.ipAddress
        },
        'SESSION_REVOKED',
        {
          sessionId: this.id,
          targetUserId: this.userId,
          severity: 'low'
        }
      );

      return true;
    } catch (error) {
      console.error('💥 Error revoking session:', error.message);
      throw error;
    }
  }

  // Static method to revoke all sessions for a user
  static async revokeAllUserSessions(userId, exceptSessionId = null, revokedBy = null) {
    try {
      if (!userId || isNaN(parseInt(userId))) {
        throw new Error('Invalid user ID');
      }

      let query = `
        UPDATE user_sessions 
        SET is_active = FALSE 
        WHERE user_id = ? AND is_active = TRUE
      `;

      const params = [parseInt(userId)];

      // Optionally keep one session active (current session)
      if (exceptSessionId) {
        query += ` AND id != ?`;
        params.push(parseInt(exceptSessionId));
      }

      const result = await secureDatabase.executeQuery(query, params);

      console.log(`🔒 Revoked ${result.affectedRows} sessions for user ${userId}`);

      // Log bulk session revocation
      logSecurityEvent(
        { 
          user: revokedBy || { id: userId }
        },
        'BULK_SESSION_REVOCATION',
        {
          targetUserId: userId,
          sessionsRevoked: result.affectedRows,
          keptSessionId: exceptSessionId,
          severity: 'medium'
        }
      );

      return result.affectedRows;
    } catch (error) {
      console.error('💥 Error revoking all user sessions:', error.message);
      throw error;
    }
  }

  // Static method to clean up expired sessions
  static async cleanupExpiredSessions() {
    try {
      const query = `
        UPDATE user_sessions 
        SET is_active = FALSE 
        WHERE expires_at <= NOW() AND is_active = TRUE
      `;

      const result = await secureDatabase.executeQuery(query);

      if (result.affectedRows > 0) {
        console.log(`🧹 Cleaned up ${result.affectedRows} expired sessions`);
      }

      return result.affectedRows;
    } catch (error) {
      console.error('💥 Error cleaning up expired sessions:', error.message);
      throw error;
    }
  }

  // Static method to get session statistics
  static async getSessionStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = TRUE AND expires_at > NOW() THEN 1 END) as active_sessions,
          COUNT(CASE WHEN is_active = FALSE THEN 1 END) as revoked_sessions,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(TIMESTAMPDIFF(MINUTE, created_at, last_activity)) as avg_session_duration
        FROM user_sessions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;

      const result = await secureDatabase.executeQuery(query);

      return result.rows[0] || {};
    } catch (error) {
      console.error('💥 Error getting session stats:', error.message);
      throw error;
    }
  }

  // Static method to detect suspicious sessions
  static async detectSuspiciousSessions() {
    try {
      // Find sessions with unusual activity patterns
      const query = `
        SELECT s.*, u.username,
               COUNT(*) as session_count,
               COUNT(DISTINCT s.ip_address) as ip_count
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          AND s.is_active = TRUE
        GROUP BY s.user_id
        HAVING session_count > 5 OR ip_count > 3
        ORDER BY session_count DESC, ip_count DESC
      `;

      const result = await secureDatabase.executeQuery(query);

      const suspiciousSessions = result.rows || [];

      // Log suspicious activity
      for (const session of suspiciousSessions) {
        logSecurityEvent(
          { user: { id: session.user_id, username: session.username } },
          'SUSPICIOUS_SESSION_PATTERN',
          {
            sessionCount: session.session_count,
            ipCount: session.ip_count,
            severity: session.session_count > 10 ? 'high' : 'medium',
            description: `User has ${session.session_count} sessions from ${session.ip_count} different IPs`
          }
        );
      }

      return suspiciousSessions;
    } catch (error) {
      console.error('💥 Error detecting suspicious sessions:', error.message);
      throw error;
    }
  }

  // Check if session is valid
  isValid() {
    if (!this.isActive) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(this.expiresAt);

    return expiresAt > now;
  }

  // Check if session is expired
  isExpired() {
    const now = new Date();
    const expiresAt = new Date(this.expiresAt);

    return expiresAt <= now;
  }

  // Get session duration in minutes
  getDurationMinutes() {
    if (!this.createdAt || !this.lastActivity) {
      return 0;
    }

    const created = new Date(this.createdAt);
    const lastActivity = new Date(this.lastActivity);

    return Math.round((lastActivity - created) / (1000 * 60));
  }

  // Convert to JSON (without sensitive data)
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      isActive: this.isActive,
      username: this.username,
      userRole: this.userRole,
      isValid: this.isValid(),
      isExpired: this.isExpired(),
      durationMinutes: this.getDurationMinutes()
    };
  }
}

module.exports = UserSession;