// Secure User model with authentication and authorization
const bcrypt = require('bcryptjs');
const secureDatabase = require('../config/database');
const { config } = require('../config/environment');
const { logDataModification, logSecurityEvent } = require('../middleware/logging');

class User {
  constructor(userData = {}) {
    this.id = userData.id || null;
    this.username = userData.username || null;
    this.email = userData.email || null;
    this.password = userData.password || null;
    this.role = userData.role || 'admin';
    this.fullName = userData.full_name || userData.fullName || null;
    this.createdAt = userData.created_at || userData.createdAt || null;
    this.updatedAt = userData.updated_at || userData.updatedAt || null;
  }

  // Static method to find user by ID
  static async findById(id) {
    try {
      if (!id || isNaN(parseInt(id))) {
        throw new Error('Invalid user ID');
      }

      const query = `
        SELECT id, username, email, role, full_name, created_at, updated_at
        FROM users 
        WHERE id = ?
        LIMIT 1
      `;
      
      const result = await secureDatabase.executeQuery(query, [parseInt(id)]);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new User(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding user by ID:', error.message);
      throw new Error('Failed to find user');
    }
  }

  // Static method to find user by username
  static async findByUsername(username) {
    try {
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        throw new Error('Invalid username');
      }

      const query = `
        SELECT id, username, email, role, full_name, created_at, updated_at
        FROM users 
        WHERE username = ?
        LIMIT 1
      `;
      
      const result = await secureDatabase.executeQuery(query, [username.trim()]);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new User(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding user by username:', error.message);
      throw new Error('Failed to find user');
    }
  }

  // Static method to find user by email
  static async findByEmail(email) {
    try {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        throw new Error('Invalid email');
      }

      const query = `
        SELECT id, username, email, role, full_name, created_at, updated_at
        FROM users 
        WHERE email = ?
        LIMIT 1
      `;
      
      const result = await secureDatabase.executeQuery(query, [email.toLowerCase().trim()]);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new User(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding user by email:', error.message);
      throw new Error('Failed to find user');
    }
  }

  // Static method for authentication
  static async authenticate(username, password) {
    try {
      if (!username || !password) {
        return { success: false, reason: 'Username and password required' };
      }

      // Find user with password (special query for authentication)
      const query = `
        SELECT id, username, email, password, role, full_name, created_at, updated_at
        FROM users 
        WHERE username = ? OR email = ?
        LIMIT 1
      `;
      
      const result = await secureDatabase.executeQuery(query, [username, username]);
      
      if (!result.rows || result.rows.length === 0) {
        return { success: false, reason: 'User not found' };
      }

      const userData = result.rows[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, userData.password);
      
      if (!isValidPassword) {
        return { success: false, reason: 'Invalid password' };
      }

      // Create user instance without password
      const user = new User({
        ...userData,
        password: undefined // Never include password in response
      });

      return { 
        success: true, 
        user,
        reason: 'Authentication successful'
      };
    } catch (error) {
      console.error('💥 Authentication error:', error.message);
      return { success: false, reason: 'Authentication failed' };
    }
  }

  // Static method to create new user
  static async create(userData, createdBy = null) {
    try {
      // Validate required fields
      const validation = User.validateUserData(userData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if username already exists
      const existingUser = await User.findByUsername(userData.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Check if email already exists
      const existingEmail = await User.findByEmail(userData.email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, config.security.bcryptRounds);

      // Insert user
      const query = `
        INSERT INTO users (username, email, password, role, full_name)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const result = await secureDatabase.executeQuery(query, [
        userData.username.trim(),
        userData.email.toLowerCase().trim(),
        hashedPassword,
        userData.role || 'admin',
        userData.fullName.trim()
      ]);

      if (!result.insertId) {
        throw new Error('Failed to create user');
      }

      // Log the creation
      if (createdBy) {
        logDataModification(
          { user: createdBy },
          'CREATE',
          'users',
          {
            id: result.insertId,
            success: true,
            after: { username: userData.username, role: userData.role }
          }
        );
      }

      // Return the created user (without password)
      return await User.findById(result.insertId);
    } catch (error) {
      console.error('💥 Error creating user:', error.message);
      throw error;
    }
  }

  // Static method to get all users
  static async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        role = null,
        search = null,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      // Validate pagination
      const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
      const validSortColumns = ['id', 'username', 'email', 'role', 'full_name', 'created_at'];
      const validSortOrders = ['ASC', 'DESC'];

      if (!validSortColumns.includes(sortBy)) {
        throw new Error('Invalid sort column');
      }

      if (!validSortOrders.includes(sortOrder.toUpperCase())) {
        throw new Error('Invalid sort order');
      }

      // Build query
      let query = `
        SELECT id, username, email, role, full_name, created_at, updated_at
        FROM users
        WHERE 1=1
      `;
      
      const params = [];

      // Add role filter
      if (role && ['admin', 'super_admin'].includes(role)) {
        query += ` AND role = ?`;
        params.push(role);
      }

      // Add search filter
      if (search && search.trim().length > 0) {
        query += ` AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)`;
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Add sorting and pagination
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
      params.push(Math.min(100, Math.max(1, limit)), offset);

      // Execute query
      const result = await secureDatabase.executeQuery(query, params);

      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1`;
      const countParams = [];

      if (role && ['admin', 'super_admin'].includes(role)) {
        countQuery += ` AND role = ?`;
        countParams.push(role);
      }

      if (search && search.trim().length > 0) {
        countQuery += ` AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)`;
        const searchTerm = `%${search.trim()}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      const countResult = await secureDatabase.executeQuery(countQuery, countParams);
      const total = countResult.rows[0].total;

      return {
        users: result.rows.map(row => new User(row)),
        pagination: {
          page: Math.max(1, page),
          limit: Math.min(100, Math.max(1, limit)),
          total,
          totalPages: Math.ceil(total / Math.min(100, Math.max(1, limit)))
        }
      };
    } catch (error) {
      console.error('💥 Error getting all users:', error.message);
      throw error;
    }
  }

  // Instance method to update user
  async update(updateData, updatedBy = null) {
    try {
      if (!this.id) {
        throw new Error('Cannot update user without ID');
      }

      // Store original data for logging
      const originalData = { ...this };

      // Validate update data
      const allowedFields = ['username', 'email', 'role', 'fullName'];
      const updateFields = [];
      const updateValues = [];

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          if (key === 'username') {
            updateFields.push('username = ?');
            updateValues.push(updateData[key].trim());
          } else if (key === 'email') {
            updateFields.push('email = ?');
            updateValues.push(updateData[key].toLowerCase().trim());
          } else if (key === 'role') {
            if (['admin', 'super_admin'].includes(updateData[key])) {
              updateFields.push('role = ?');
              updateValues.push(updateData[key]);
            }
          } else if (key === 'fullName') {
            updateFields.push('full_name = ?');
            updateValues.push(updateData[key].trim());
          }
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Check for conflicts if updating username or email
      if (updateData.username && updateData.username !== this.username) {
        const existingUser = await User.findByUsername(updateData.username);
        if (existingUser && existingUser.id !== this.id) {
          throw new Error('Username already exists');
        }
      }

      if (updateData.email && updateData.email !== this.email) {
        const existingEmail = await User.findByEmail(updateData.email);
        if (existingEmail && existingEmail.id !== this.id) {
          throw new Error('Email already exists');
        }
      }

      // Update user
      updateFields.push('updated_at = NOW()');
      updateValues.push(this.id);

      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      
      await secureDatabase.executeQuery(query, updateValues);

      // Log the update
      if (updatedBy) {
        logDataModification(
          { user: updatedBy },
          'UPDATE',
          'users',
          {
            id: this.id,
            success: true,
            before: originalData,
            after: updateData,
            changes: Object.keys(updateData)
          }
        );
      }

      // Refresh user data
      const updatedUser = await User.findById(this.id);
      Object.assign(this, updatedUser);

      return this;
    } catch (error) {
      console.error('💥 Error updating user:', error.message);
      throw error;
    }
  }

  // Instance method to delete user
  async delete(deletedBy = null) {
    try {
      if (!this.id) {
        throw new Error('Cannot delete user without ID');
      }

      // Check if user is trying to delete themselves
      if (deletedBy && deletedBy.id === this.id) {
        throw new Error('Cannot delete your own account');
      }

      // Store data for logging
      const userData = { ...this };

      const query = `DELETE FROM users WHERE id = ?`;
      const result = await secureDatabase.executeQuery(query, [this.id]);

      if (result.affectedRows === 0) {
        throw new Error('User not found or already deleted');
      }

      // Log the deletion
      if (deletedBy) {
        logDataModification(
          { user: deletedBy },
          'DELETE',
          'users',
          {
            id: this.id,
            success: true,
            before: userData
          }
        );
      }

      return true;
    } catch (error) {
      console.error('💥 Error deleting user:', error.message);
      throw error;
    }
  }

  // Instance method to change password
  async changePassword(currentPassword, newPassword, changedBy = null) {
    try {
      if (!this.id) {
        throw new Error('Cannot change password without user ID');
      }

      // Get current password hash
      const query = `SELECT password FROM users WHERE id = ? LIMIT 1`;
      const result = await secureDatabase.executeQuery(query, [this.id]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      const passwordValidation = User.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      // Update password
      const updateQuery = `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`;
      await secureDatabase.executeQuery(updateQuery, [hashedPassword, this.id]);

      // Log password change
      if (changedBy) {
        logSecurityEvent(
          { user: changedBy },
          'PASSWORD_CHANGE',
          {
            targetUserId: this.id,
            targetUsername: this.username,
            severity: 'medium'
          }
        );
      }

      return true;
    } catch (error) {
      console.error('💥 Error changing password:', error.message);
      throw error;
    }
  }

  // Static method to validate user data
  static validateUserData(userData) {
    const errors = [];

    // Username validation
    if (!userData.username || typeof userData.username !== 'string') {
      errors.push('Username is required');
    } else if (userData.username.length < 3 || userData.username.length > 30) {
      errors.push('Username must be between 3 and 30 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(userData.username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Email validation
    if (!userData.email || typeof userData.email !== 'string') {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Email must be valid');
    } else if (userData.email.length > 255) {
      errors.push('Email must not exceed 255 characters');
    }

    // Password validation
    if (userData.password) {
      const passwordValidation = User.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    // Full name validation
    if (!userData.fullName || typeof userData.fullName !== 'string') {
      errors.push('Full name is required');
    } else if (userData.fullName.length < 2 || userData.fullName.length > 100) {
      errors.push('Full name must be between 2 and 100 characters');
    }

    // Role validation
    if (userData.role && !['admin', 'super_admin'].includes(userData.role)) {
      errors.push('Role must be admin or super_admin');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static method to validate password
  static validatePassword(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Convert to JSON (without sensitive data)
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      fullName: this.fullName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Check if user has permission
  hasPermission(requiredRole) {
    const rolePriority = {
      'admin': 1,
      'super_admin': 2
    };

    return rolePriority[this.role] >= rolePriority[requiredRole];
  }

  // Check if user is admin
  isAdmin() {
    return ['admin', 'super_admin'].includes(this.role);
  }

  // Check if user is super admin
  isSuperAdmin() {
    return this.role === 'super_admin';
  }
}

module.exports = User;