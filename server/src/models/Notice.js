// Secure Notice model with file handling and SEO features
const secureDatabase = require('../config/database');
const { logDataModification, logSecurityEvent } = require('../middleware/logging');
const path = require('path');
const fs = require('fs').promises;

class Notice {
  constructor(noticeData = {}) {
    this.id = noticeData.id || null;
    this.title = noticeData.title || null;
    this.description = noticeData.description || null;
    this.imageUrl = noticeData.image_url || noticeData.imageUrl || null;
    this.files = this.parseFiles(noticeData.files);
    this.priority = noticeData.priority || 'medium';
    this.status = noticeData.status || 'draft';
    this.slug = noticeData.slug || null;
    this.createdBy = noticeData.created_by || noticeData.createdBy || null;
    this.publishedAt = noticeData.published_at || noticeData.publishedAt || null;
    this.createdAt = noticeData.created_at || noticeData.createdAt || null;
    this.updatedAt = noticeData.updated_at || noticeData.updatedAt || null;
    
    // Joined data
    this.creatorUsername = noticeData.creator_username || null;
    this.creatorName = noticeData.creator_name || null;
    this.viewCount = noticeData.view_count || 0;
    this.uniqueViewers = noticeData.unique_viewers || 0;
  }

  // Parse files JSON safely
  parseFiles(filesData) {
    try {
      // If it's already an array, return it
      if (Array.isArray(filesData)) {
        return filesData;
      }
      
      // If it's a JSON string, parse it
      if (typeof filesData === 'string') {
        try {
          const parsedData = JSON.parse(filesData);
          return Array.isArray(parsedData) ? parsedData : [];
        } catch (e) {
          console.warn('Failed to parse files JSON string:', e.message);
          return [];
        }
      }
      
      // If it's a Buffer or has data property (MySQL BLOB format)
      if (filesData && typeof filesData === 'object') {
        if (Buffer.isBuffer(filesData)) {
          try {
            const jsonString = filesData.toString('utf8');
            return JSON.parse(jsonString);
          } catch (e) {
            console.warn('Failed to parse files from buffer:', e.message);
            return [];
          }
        }
        
        // Handle MySQL binary format
        if (filesData.type === 'Buffer' && Array.isArray(filesData.data)) {
          try {
            const buffer = Buffer.from(filesData.data);
            const jsonString = buffer.toString('utf8');
            return JSON.parse(jsonString);
          } catch (e) {
            console.warn('Failed to parse files from MySQL buffer:', e.message);
            return [];
          }
        }
      }
      
      // Default case
      return [];
    } catch (error) {
      console.error('Error parsing files data:', error);
      return [];
    }
  }

  // Static method to find notice by ID
  static async findById(id, includeStats = false) {
    try {
      if (!id || isNaN(parseInt(id))) {
        throw new Error('Invalid notice ID');
      }

      let query;
      if (includeStats) {
        query = `
          SELECT n.*, u.username as creator_username, u.full_name as creator_name,
                 COALESCE(sv.view_count, 0) as view_count,
                 COALESCE(sv.unique_viewers, 0) as unique_viewers
          FROM notices n
          LEFT JOIN users u ON n.created_by = u.id
          LEFT JOIN (
            SELECT notice_id, COUNT(*) as view_count, COUNT(DISTINCT session_id) as unique_viewers
            FROM site_visits 
            WHERE notice_id = ?
          ) sv ON n.id = sv.notice_id
          WHERE n.id = ?
          LIMIT 1
        `;
      } else {
        query = `
          SELECT n.*, u.username as creator_username, u.full_name as creator_name
          FROM notices n
          LEFT JOIN users u ON n.created_by = u.id
          WHERE n.id = ?
          LIMIT 1
        `;
      }
      
      const params = includeStats ? [parseInt(id), parseInt(id)] : [parseInt(id)];
      const result = await secureDatabase.executeQuery(query, params);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new Notice(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding notice by ID:', error.message);
      throw new Error('Failed to find notice');
    }
  }

  // Static method to find notice by slug
  static async findBySlug(slug, includeStats = false) {
    try {
      if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
        throw new Error('Invalid notice slug');
      }

      let query;
      if (includeStats) {
        query = `
          SELECT n.*, u.username as creator_username, u.full_name as creator_name,
                 COALESCE(sv.view_count, 0) as view_count,
                 COALESCE(sv.unique_viewers, 0) as unique_viewers
          FROM notices n
          LEFT JOIN users u ON n.created_by = u.id
          LEFT JOIN (
            SELECT notice_id, COUNT(*) as view_count, COUNT(DISTINCT session_id) as unique_viewers
            FROM site_visits 
            WHERE notice_id = (SELECT id FROM notices WHERE slug = ? LIMIT 1)
          ) sv ON n.id = sv.notice_id
          WHERE n.slug = ?
          LIMIT 1
        `;
      } else {
        query = `
          SELECT n.*, u.username as creator_username, u.full_name as creator_name
          FROM notices n
          LEFT JOIN users u ON n.created_by = u.id
          WHERE n.slug = ?
          LIMIT 1
        `;
      }
      
      const params = includeStats ? [slug.trim(), slug.trim()] : [slug.trim()];
      const result = await secureDatabase.executeQuery(query, params);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return new Notice(result.rows[0]);
    } catch (error) {
      console.error('💥 Error finding notice by slug:', error.message);
      throw new Error('Failed to find notice');
    }
  }

  // Static method to get all notices
  static async getAll(options = {}) {
    try {
        const {
            page = 1,
            limit = 10,
            status = null,
            priority = null,
            search = null,
            createdBy = null,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            includeStats = false,
            publishedOnly = false,
            userId = null,
            showOnlyOwnDrafts = false
        } = options;

        // Validate pagination
        const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
        const validSortColumns = ['id', 'title', 'priority', 'status', 'created_at', 'updated_at', 'published_at'];
        const validSortOrders = ['ASC', 'DESC'];

        if (!validSortColumns.includes(sortBy)) {
            throw new Error('Invalid sort column');
        }

        if (!validSortOrders.includes(sortOrder.toUpperCase())) {
            throw new Error('Invalid sort order');
        }

        // Build base query
        let query = `
            SELECT n.*, u.username as creator_username, u.full_name as creator_name
            ${includeStats ? `, COALESCE(sv.view_count, 0) as view_count, COALESCE(sv.unique_viewers, 0) as unique_viewers` : ''}
            FROM notices n
            LEFT JOIN users u ON n.created_by = u.id
        `;

        if (includeStats) {
            query += `
            LEFT JOIN (
                SELECT notice_id, COUNT(*) as view_count, COUNT(DISTINCT session_id) as unique_viewers
                FROM site_visits 
                GROUP BY notice_id
            ) sv ON n.id = sv.notice_id
            `;
        }

        query += ` WHERE 1=1`;
        const params = [];

        // Add filters
        if (publishedOnly) {
            query += ` AND n.status = 'published' AND n.published_at IS NOT NULL`;
        } else if (status) {
            query += ` AND n.status = ?`;
            params.push(status);
        }

        if (priority) {
            query += ` AND n.priority = ?`;
            params.push(priority);
        }

        if (search && search.trim().length > 0) {
            query += ` AND (n.title LIKE ? OR n.description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }

        if (createdBy) {
            query += ` AND n.created_by = ?`;
            params.push(createdBy);
        }

        // Handle draft visibility
        if (showOnlyOwnDrafts && userId) {
            query += ` AND (n.status = 'published' OR (n.status = 'draft' AND n.created_by = ?))`;
            params.push(userId);
        }

        // Add sorting
        if (sortBy === 'priority') {
            query += ` ORDER BY CASE n.priority 
                WHEN 'high' THEN 1 
                WHEN 'medium' THEN 2 
                WHEN 'low' THEN 3 
            END ${sortOrder}, n.created_at DESC`;
        } else {
            // Default sorting
            query += ` ORDER BY n.${sortBy} ${sortOrder}`;
        }

        // Add pagination
        query += ` LIMIT ? OFFSET ?`;
        params.push(Math.min(100, Math.max(1, limit)), offset);

        // Execute query
        const result = await secureDatabase.executeQuery(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as total FROM notices n WHERE 1=1`;
        const countParams = [];

        if (publishedOnly) {
            countQuery += ` AND n.status = 'published' AND n.published_at IS NOT NULL`;
        } else if (status) {
            countQuery += ` AND n.status = ?`;
            countParams.push(status);
        }

        if (priority) {
            countQuery += ` AND n.priority = ?`;
            countParams.push(priority);
        }

        if (search && search.trim().length > 0) {
            countQuery += ` AND (n.title LIKE ? OR n.description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            countParams.push(searchTerm, searchTerm);
        }

        if (createdBy) {
            countQuery += ` AND n.created_by = ?`;
            countParams.push(createdBy);
        }

        if (showOnlyOwnDrafts && userId) {
            countQuery += ` AND (n.status = 'published' OR (n.status = 'draft' AND n.created_by = ?))`;
            countParams.push(userId);
        }

        const countResult = await secureDatabase.executeQuery(countQuery, countParams);
        const total = countResult.rows[0].total;

        return {
            notices: result.rows.map(row => new Notice(row)),
            pagination: {
                page: Math.max(1, page),
                limit: Math.min(100, Math.max(1, limit)),
                total,
                totalPages: Math.ceil(total / Math.min(100, Math.max(1, limit)))
            }
        };
    } catch (error) {
        console.error('💥 Error getting all notices:', error.message);
        throw error;
    }
  }

  // Static method to create new notice
  static async create(noticeData, createdBy) {
    try {
      if (!noticeData.title || !noticeData.description) {
        throw new Error('Title and description are required');
      }

      if (!createdBy || !createdBy.id) {
        throw new Error('Creator information required');
      }

      // Generate unique slug
      const slug = await Notice.generateUniqueSlug(noticeData.title);

      // Prepare files JSON
      const filesJson = noticeData.files && noticeData.files.length > 0 
        ? JSON.stringify(noticeData.files) 
        : null;

      // Set published_at if status is published
      const publishedAt = noticeData.status === 'published' ? new Date() : null;

      // Insert notice with proper text handling
      const query = `
        INSERT INTO notices (title, description, image_url, files, priority, status, slug, created_by, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await secureDatabase.executeQuery(query, [
        String(noticeData.title).trim(),        // Ensure string
        String(noticeData.description).trim(),  // Ensure string
        noticeData.imageUrl || null,
        filesJson,
        noticeData.priority || 'medium',
        noticeData.status || 'draft',
        slug,
        createdBy.id,
        publishedAt
      ]);

      if (!result.insertId) {
        throw new Error('Failed to create notice');
      }

      // Log the creation
      logDataModification(
        { user: createdBy },
        'CREATE',
        'notices',
        {
          id: result.insertId,
          success: true,
          after: {
            title: noticeData.title,
            status: noticeData.status,
            priority: noticeData.priority
          }
        }
      );

      // Return the created notice
      return await Notice.findById(result.insertId);
    } catch (error) {
      console.error('💥 Error creating notice:', error.message);
      throw error;
    }
  }

  // Instance method to update notice
  async update(updateData, updatedBy) {
    try {
      if (!this.id) {
        throw new Error('Cannot update notice without ID');
      }

      if (!updatedBy || !updatedBy.id) {
        throw new Error('Updater information required');
      }

      // Store original data for logging
      const originalData = { ...this };

      // Validate update data
      const allowedFields = ['title', 'description', 'imageUrl', 'files', 'priority', 'status'];
      const updateFields = [];
      const updateValues = [];

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          switch (key) {
            case 'title':
              if (updateData[key] && updateData[key].trim().length > 0) {
                updateFields.push('title = ?');
                updateValues.push(updateData[key].trim());
              }
              break;
            case 'description':
              if (updateData[key] && updateData[key].trim().length > 0) {
                updateFields.push('description = ?');
                updateValues.push(updateData[key].trim());
              }
              break;
            case 'imageUrl':
              updateFields.push('image_url = ?');
              updateValues.push(updateData[key] || null);
              break;
            case 'files':
              updateFields.push('files = ?');
              updateValues.push(updateData[key] && updateData[key].length > 0 ? 
                JSON.stringify(updateData[key]) : null);
              break;
            case 'priority':
              if (['low', 'medium', 'high'].includes(updateData[key])) {
                updateFields.push('priority = ?');
                updateValues.push(updateData[key]);
              }
              break;
            case 'status':
              if (['draft', 'published'].includes(updateData[key])) {
                updateFields.push('status = ?');
                updateValues.push(updateData[key]);
                
                // Handle published_at when status changes
                if (updateData[key] === 'published' && this.status !== 'published') {
                  updateFields.push('published_at = NOW()');
                } else if (updateData[key] === 'draft') {
                  updateFields.push('published_at = NULL');
                }
              }
              break;
          }
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Update slug if title changed
      if (updateData.title && updateData.title !== this.title) {
        const newSlug = await Notice.generateUniqueSlug(updateData.title, this.id);
        updateFields.push('slug = ?');
        updateValues.push(newSlug);
      }

      // Update notice
      updateFields.push('updated_at = NOW()');
      updateValues.push(this.id);
      
      const query = `UPDATE notices SET ${updateFields.join(', ')} WHERE id = ?`;
      
      await secureDatabase.executeQuery(query, updateValues);

      // Log the update
      logDataModification(
        { user: updatedBy },
        'UPDATE',
        'notices',
        {
          id: this.id,
          success: true,
          before: { 
            title: originalData.title,
            status: originalData.status,
            priority: originalData.priority
          },
          after: updateData,
          changes: Object.keys(updateData)
        }
      );

      // Refresh notice data
      const updatedNotice = await Notice.findById(this.id);
      Object.assign(this, updatedNotice);

      return this;
    } catch (error) {
      console.error('💥 Error updating notice:', error.message);
      throw error;
    }
  }

  // Instance method to delete notice
  async delete(deletedBy) {
    try {
      if (!this.id) {
        throw new Error('Cannot delete notice without ID');
      }

      if (!deletedBy || !deletedBy.id) {
        throw new Error('Deleter information required');
      }

      // Store data for logging
      const noticeData = { ...this };

      // Delete associated files if they exist
      await this.deleteAssociatedFiles();

      const query = `DELETE FROM notices WHERE id = ?`;
      const result = await secureDatabase.executeQuery(query, [this.id]);

      if (result.affectedRows === 0) {
        throw new Error('Notice not found or already deleted');
      }

      // Log the deletion
      logDataModification(
        { user: deletedBy },
        'DELETE',
        'notices',
        {
          id: this.id,
          success: true,
          before: {
            title: noticeData.title,
            status: noticeData.status,
            priority: noticeData.priority
          }
        }
      );

      return true;
    } catch (error) {
      console.error('💥 Error deleting notice:', error.message);
      throw error;
    }
  }

  // Delete associated files
  async deleteAssociatedFiles() {
    try {
      // Delete image file if exists
      if (this.imageUrl) {
        const imagePath = path.join(__dirname, '../../uploads', this.imageUrl.replace('/uploads/', ''));
        try {
          await fs.unlink(imagePath);
        } catch (error) {
          console.warn(`Could not delete image file: ${imagePath}`, error.message);
        }
      }

      // Delete attachment files if exist
      if (this.files && Array.isArray(this.files)) {
        for (const file of this.files) {
          if (file.url) {
            const filePath = path.join(__dirname, '../../uploads', file.url.replace('/uploads/', ''));
            try {
              await fs.unlink(filePath);
            } catch (error) {
              console.warn(`Could not delete file: ${filePath}`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error deleting associated files:', error.message);
    }
  }

  // Static method to generate unique slug
  static async generateUniqueSlug(title, excludeId = null) {
    try {
      if (!title || typeof title !== 'string') {
        throw new Error('Valid title is required to generate slug');
      }

      // Create base slug - more restrictive to avoid issues
      let baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
        .replace(/\s+/g, '-')         // Replace spaces with hyphens
        .replace(/-+/g, '-')          // Remove consecutive hyphens
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens

      // Truncate slug to a reasonable length (100 chars max)
      baseSlug = baseSlug.substring(0, 100);

      // If slug is too short after processing, use a fallback
      if (baseSlug.length < 3) {
        baseSlug = `notice-${Date.now().toString(36)}`;
      }

      let slug = baseSlug;
      let counter = 1;

      while (true) {
        // Check if slug exists (excluding current notice if updating)
        const query = excludeId
          ? 'SELECT id FROM notices WHERE slug = ? AND id != ? LIMIT 1'
          : 'SELECT id FROM notices WHERE slug = ? LIMIT 1';
        
        const params = excludeId 
          ? [slug, excludeId]
          : [slug];
        
        const result = await secureDatabase.executeQuery(query, params);
        
        if (!result.rows || result.rows.length === 0) {
          break; // Slug is unique, we can use it
        }
        
        // Slug exists, try with counter
        slug = `${baseSlug}-${counter}`;
        counter++;
        
        // If we've tried too many times, add a timestamp to ensure uniqueness
        if (counter > 10) {
          slug = `${baseSlug}-${Date.now().toString(36)}`;
          break;
        }
      }
      
      return slug;
    } catch (error) {
      console.error('💥 Error generating unique slug:', error.message);
      // Fallback to a timestamp-based slug if there's an error
      return `notice-${Date.now().toString(36)}`;
    }
  }

  // Static method to validate notice data
  static validateNoticeData(noticeData) {
    const errors = [];

    // Title validation
    if (!noticeData.title || typeof noticeData.title !== 'string') {
      errors.push('Title is required');
    } else if (noticeData.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters long');
    } else if (noticeData.title.length > 500) {
      errors.push('Title must not exceed 500 characters');
    }

    // Description validation
    if (!noticeData.description || typeof noticeData.description !== 'string') {
      errors.push('Description is required');
    } else if (noticeData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    } else if (noticeData.description.length > 10000) {
      errors.push('Description must not exceed 10,000 characters');
    }

    // Priority validation
    if (noticeData.priority && !['low', 'medium', 'high'].includes(noticeData.priority)) {
      errors.push('Priority must be low, medium, or high');
    }

    // Status validation
    if (noticeData.status && !['draft', 'published'].includes(noticeData.status)) {
      errors.push('Status must be draft or published');
    }

    // Files validation
    if (noticeData.files && Array.isArray(noticeData.files)) {
      if (noticeData.files.length > 10) {
        errors.push('Maximum 10 files allowed per notice');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static method to search notices
  static async search(searchQuery, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        publishedOnly = true
      } = options;

      if (!searchQuery || searchQuery.trim().length === 0) {
        return { notices: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } };
      }

      const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));

      // Use full-text search if available, otherwise LIKE search
      let query = `
        SELECT n.*, u.username as creator_username, u.full_name as creator_name,
               COALESCE(sv.view_count, 0) as view_count
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        LEFT JOIN (
          SELECT notice_id, COUNT(*) as view_count
          FROM site_visits 
          GROUP BY notice_id
        ) sv ON n.id = sv.notice_id
        WHERE MATCH(n.title, n.description) AGAINST(? IN NATURAL LANGUAGE MODE)
      `;

      const params = [searchQuery.trim()];

      if (publishedOnly) {
        query += ` AND n.status = 'published' AND n.published_at IS NOT NULL`;
      }

      query += ` ORDER BY n.published_at DESC LIMIT ? OFFSET ?`;
      params.push(Math.min(100, Math.max(1, limit)), offset);

      const result = await secureDatabase.executeQuery(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM notices n 
        WHERE MATCH(n.title, n.description) AGAINST(? IN NATURAL LANGUAGE MODE)
      `;
      const countParams = [searchQuery.trim()];

      if (publishedOnly) {
        countQuery += ` AND n.status = 'published' AND n.published_at IS NOT NULL`;
      }

      const countResult = await secureDatabase.executeQuery(countQuery, countParams);
      const total = countResult.rows[0].total;

      return {
        notices: result.rows.map(row => new Notice(row)),
        pagination: {
          page: Math.max(1, page),
          limit: Math.min(100, Math.max(1, limit)),
          total,
          totalPages: Math.ceil(total / Math.min(100, Math.max(1, limit)))
        },
        searchQuery: searchQuery.trim()
      };
    } catch (error) {
      console.error('💥 Error searching notices:', error.message);
      throw error;
    }
  }

  // Get related notices (same priority/creator)
  async getRelated(limit = 3) {
    try {
      if (!this.id) {
        return [];
      }

      const query = `
        SELECT n.*, u.username as creator_username, u.full_name as creator_name
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        WHERE n.id != ? 
          AND n.status = 'published' 
          AND n.published_at IS NOT NULL
          AND (n.priority = ? OR n.created_by = ?)
        ORDER BY n.published_at DESC
        LIMIT ?
      `;

      const result = await secureDatabase.executeQuery(query, [
        this.id,
        this.priority,
        this.createdBy,
        Math.min(10, Math.max(1, limit))
      ]);

      return result.rows.map(row => new Notice(row));
    } catch (error) {
      console.error('💥 Error getting related notices:', error.message);
      return [];
    }
  }

  // Convert to JSON
  toJSON() {
    // Handle binary description
    let description = this.description;
    if (Buffer.isBuffer(description)) {
      description = description.toString('utf8');
    } else if (description && description.data && Array.isArray(description.data)) {
      description = Buffer.from(description.data).toString('utf8');
    }
    
    return {
      id: this.id,
      title: this.title,
      description: description,
      imageUrl: this.imageUrl,
      files: this.files,
      priority: this.priority,
      status: this.status,
      slug: this.slug,
      createdBy: this.createdBy,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      creatorUsername: this.creatorUsername,
      creatorName: this.creatorName,
      viewCount: this.viewCount,
      uniqueViewers: this.uniqueViewers
    };
  }

  // Check if notice is published
  isPublished() {
    return this.status === 'published' && this.publishedAt;
  }

  // Check if notice is draft
  isDraft() {
    return this.status === 'draft';
  }

  // Get priority display name
  getPriorityDisplay() {
    const displays = {
      'low': 'Low Priority',
      'medium': 'Medium Priority',
      'high': 'High Priority'
    };
    return displays[this.priority] || 'Unknown Priority';
  }

  // Get status display name
  getStatusDisplay() {
    const displays = {
      'draft': 'Draft',
      'published': 'Published'
    };
    return displays[this.status] || 'Unknown Status';
  }
}

module.exports = Notice;