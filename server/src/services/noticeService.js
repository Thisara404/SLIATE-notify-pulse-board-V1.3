// Notice Service - Business logic for notice management
const Notice = require('../models/Notice');
const SiteVisit = require('../models/SiteVisit');
const { generateSlug } = require('../utils/slugGenerator');
const { sanitize } = require('../utils/inputSanitizer');
const { validateFile } = require('../utils/fileValidator');
const { 
  logUserAction, 
  logDataModification,
  logSecurityEvent 
} = require('../utils/logger');

class NoticeService {
  constructor() {
    // Notice configuration
    this.noticeConfig = {
      maxTitleLength: 200,
      maxDescriptionLength: 10000,
      maxFilesPerNotice: 10,
      allowedFileTypes: ['images', 'documents'],
      defaultPriority: 'medium',
      validPriorities: ['low', 'medium', 'high'],
      validStatuses: ['draft', 'published', 'archived'],
      slugOptions: {
        maxLength: 100,
        removeStopWords: true,
        ensureUnique: true
      }
    };

    // Search configuration
    this.searchConfig = {
      maxResults: 100,
      defaultLimit: 10,
      minQueryLength: 3,
      searchableFields: ['title', 'description'],
      searchWeights: {
        title: 3,
        description: 1
      }
    };

    // Analytics configuration
    this.analyticsConfig = {
      trackViews: true,
      trackUniqueVisitors: true,
      trackReferrers: true,
      trackUserAgents: true,
      retentionPeriod: 90 // days
    };
  }

  /**
   * Create new notice
   * @param {Object} noticeData - Notice data
   * @param {Object} user - User creating the notice
   * @param {Object} context - Request context
   * @returns {Object} - Creation result
   */
  async createNotice(noticeData, user, context = {}) {
    try {
      console.log(`📝 Creating notice: "${noticeData.title}" by ${user.username}`);

      // Step 1: Validate and sanitize input
      const validation = await this.validateNoticeData(noticeData, 'create');
      if (!validation.valid) {
        return validation;
      }

      const sanitizedData = validation.sanitizedData;

      // Step 2: Generate unique slug
      const slugResult = await this.generateUniqueSlug(sanitizedData.title);
      if (!slugResult.success) {
        return {
          success: false,
          reason: 'slug_generation_failed',
          message: 'Failed to generate URL slug'
        };
      }

      // Step 3: Validate files if provided
      if (sanitizedData.files && sanitizedData.files.length > 0) {
        const fileValidation = await this.validateNoticeFiles(sanitizedData.files, context);
        if (!fileValidation.valid) {
          return fileValidation;
        }
        sanitizedData.files = fileValidation.validatedFiles;
      }

      // Step 4: Create notice
      const noticeCreateData = {
        ...sanitizedData,
        slug: slugResult.slug,
        createdBy: user.id,
        status: sanitizedData.status || 'draft'
      };

      const notice = await Notice.create(noticeCreateData);

      console.log(`✅ Notice created successfully: ${notice.title} (ID: ${notice.id})`);

      // Step 5: Log the creation
      await logUserAction(context, 'NOTICE_CREATED', {
        noticeId: notice.id,
        noticeTitle: notice.title,
        noticeSlug: notice.slug,
        status: notice.status,
        priority: notice.priority
      });

      await logDataModification(context, 'CREATE', 'notices', {
        recordId: notice.id,
        newValues: {
          title: notice.title,
          status: notice.status,
          priority: notice.priority
        }
      });

      return {
        success: true,
        notice: notice.toJSON(),
        message: 'Notice created successfully'
      };

    } catch (error) {
      console.error('💥 Notice creation error:', error.message);
      return {
        success: false,
        reason: 'creation_error',
        message: 'Failed to create notice'
      };
    }
  }

  /**
   * Update existing notice
   * @param {number} noticeId - Notice ID
   * @param {Object} updateData - Update data
   * @param {Object} user - User updating the notice
   * @param {Object} context - Request context
   * @returns {Object} - Update result
   */
  async updateNotice(noticeId, updateData, user, context = {}) {
    try {
      console.log(`📝 Updating notice ID: ${noticeId} by ${user.username}`);

      // Step 1: Find notice
      const notice = await Notice.findById(noticeId);
      if (!notice) {
        return {
          success: false,
          reason: 'notice_not_found',
          message: 'Notice not found'
        };
      }

      // Step 2: Check permissions
      const permissionCheck = await this.checkNoticePermissions(notice, user, 'update');
      if (!permissionCheck.allowed) {
        await logSecurityEvent(context, 'UNAUTHORIZED_NOTICE_UPDATE', {
          noticeId: notice.id,
          attemptedBy: user.username,
          noticeOwner: notice.creatorUsername,
          severity: 'medium'
        });

        return permissionCheck;
      }

      // Step 3: Validate and sanitize update data
      const validation = await this.validateNoticeData(updateData, 'update');
      if (!validation.valid) {
        return validation;
      }

      const sanitizedData = validation.sanitizedData;

      // Step 4: Handle slug update if title changed
      if (sanitizedData.title && sanitizedData.title !== notice.title) {
        const slugResult = await this.generateUniqueSlug(sanitizedData.title, notice.id);
        if (slugResult.success) {
          sanitizedData.slug = slugResult.slug;
        }
      }

      // Step 5: Validate files if provided
      if (sanitizedData.files && sanitizedData.files.length > 0) {
        const fileValidation = await this.validateNoticeFiles(sanitizedData.files, context);
        if (!fileValidation.valid) {
          return fileValidation;
        }
        sanitizedData.files = fileValidation.validatedFiles;
      }

      // Step 6: Store old values for logging
      const oldValues = {
        title: notice.title,
        description: notice.description,
        status: notice.status,
        priority: notice.priority,
        imageUrl: notice.imageUrl
      };

      // Step 7: Update notice
      await notice.update(sanitizedData, user);

      console.log(`✅ Notice updated successfully: ${notice.title}`);

      // Step 8: Log the update
      await logUserAction(context, 'NOTICE_UPDATED', {
        noticeId: notice.id,
        noticeTitle: notice.title,
        changedFields: Object.keys(sanitizedData)
      });

      await logDataModification(context, 'UPDATE', 'notices', {
        recordId: notice.id,
        oldValues,
        newValues: sanitizedData,
        changes: Object.keys(sanitizedData)
      });

      return {
        success: true,
        notice: notice.toJSON(),
        message: 'Notice updated successfully'
      };

    } catch (error) {
      console.error('💥 Notice update error:', error.message);
      return {
        success: false,
        reason: 'update_error',
        message: 'Failed to update notice'
      };
    }
  }

  /**
   * Delete notice
   * @param {number} noticeId - Notice ID
   * @param {Object} user - User deleting the notice
   * @param {Object} context - Request context
   * @returns {Object} - Deletion result
   */
  async deleteNotice(noticeId, user, context = {}) {
    try {
      console.log(`🗑️ Deleting notice ID: ${noticeId} by ${user.username}`);

      // Step 1: Find notice
      const notice = await Notice.findById(noticeId);
      if (!notice) {
        return {
          success: false,
          reason: 'notice_not_found',
          message: 'Notice not found'
        };
      }

      // Step 2: Check permissions
      const permissionCheck = await this.checkNoticePermissions(notice, user, 'delete');
      if (!permissionCheck.allowed) {
        await logSecurityEvent(context, 'UNAUTHORIZED_NOTICE_DELETION', {
          noticeId: notice.id,
          attemptedBy: user.username,
          noticeOwner: notice.creatorUsername,
          severity: 'high'
        });

        return permissionCheck;
      }

      // Step 3: Store notice data for logging
      const noticeData = {
        id: notice.id,
        title: notice.title,
        slug: notice.slug,
        status: notice.status,
        createdBy: notice.createdBy
      };

      // Step 4: Delete notice
      await notice.delete(user);

      console.log(`✅ Notice deleted successfully: ${noticeData.title}`);

      // Step 5: Log the deletion
      await logUserAction(context, 'NOTICE_DELETED', {
        noticeId: noticeData.id,
        noticeTitle: noticeData.title,
        noticeSlug: noticeData.slug
      });

      await logDataModification(context, 'DELETE', 'notices', {
        recordId: noticeData.id,
        oldValues: noticeData
      });

      return {
        success: true,
        deletedNotice: noticeData,
        message: 'Notice deleted successfully'
      };

    } catch (error) {
      console.error('💥 Notice deletion error:', error.message);
      return {
        success: false,
        reason: 'deletion_error',
        message: 'Failed to delete notice'
      };
    }
  }

  /**
   * Publish notice
   * @param {number} noticeId - Notice ID
   * @param {Object} user - User publishing the notice
   * @param {Object} context - Request context
   * @returns {Object} - Publishing result
   */
  async publishNotice(noticeId, user, context = {}) {
    try {
      console.log(`📢 Publishing notice ID: ${noticeId} by ${user.username}`);

      // Step 1: Find notice
      const notice = await Notice.findById(noticeId);
      if (!notice) {
        return {
          success: false,
          reason: 'notice_not_found',
          message: 'Notice not found'
        };
      }

      // Step 2: Check permissions
      const permissionCheck = await this.checkNoticePermissions(notice, user, 'publish');
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 3: Check if already published
      if (notice.isPublished()) {
        return {
          success: false,
          reason: 'already_published',
          message: 'Notice is already published'
        };
      }

      // Step 4: Validate notice is ready for publication
      const publicationCheck = await this.validateNoticeForPublication(notice);
      if (!publicationCheck.valid) {
        return publicationCheck;
      }

      // Step 5: Publish notice
      await notice.update({ 
        status: 'published',
        publishedAt: new Date()
      }, user);

      console.log(`✅ Notice published successfully: ${notice.title}`);

      // Step 6: Log the publication
      await logUserAction(context, 'NOTICE_PUBLISHED', {
        noticeId: notice.id,
        noticeTitle: notice.title,
        noticeSlug: notice.slug,
        publishedBy: user.username
      });

      return {
        success: true,
        notice: notice.toJSON(),
        message: 'Notice published successfully'
      };

    } catch (error) {
      console.error('💥 Notice publication error:', error.message);
      return {
        success: false,
        reason: 'publication_error',
        message: 'Failed to publish notice'
      };
    }
  }

  /**
   * Search notices
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {Object} context - Request context
   * @returns {Object} - Search results
   */
  async searchNotices(query, options = {}, context = {}) {
    try {
      console.log(`🔍 Searching notices: "${query}"`);

      // Step 1: Validate search query
      const queryValidation = await this.validateSearchQuery(query);
      if (!queryValidation.valid) {
        return queryValidation;
      }

      // Step 2: Prepare search options
      const searchOptions = {
        page: Math.max(1, parseInt(options.page) || 1),
        limit: Math.min(this.searchConfig.maxResults, parseInt(options.limit) || this.searchConfig.defaultLimit),
        publishedOnly: options.publishedOnly !== false,
        sortBy: options.sortBy || 'relevance',
        sortOrder: options.sortOrder || 'DESC'
      };

      // Step 3: Perform search
      const searchResult = await Notice.search(queryValidation.sanitizedQuery, searchOptions);

      // Step 4: Log search
      await logUserAction(context, 'NOTICE_SEARCH', {
        query: queryValidation.sanitizedQuery,
        resultsCount: searchResult.pagination.total,
        page: searchOptions.page,
        limit: searchOptions.limit
      });

      console.log(`✅ Search completed: ${searchResult.pagination.total} results found`);

      return {
        success: true,
        results: searchResult.notices.map(notice => notice.toJSON()),
        pagination: searchResult.pagination,
        searchQuery: queryValidation.sanitizedQuery,
        searchOptions
      };

    } catch (error) {
      console.error('💥 Notice search error:', error.message);
      return {
        success: false,
        reason: 'search_error',
        message: 'Failed to search notices'
      };
    }
  }

  /**
   * Get notice analytics
   * @param {number} noticeId - Notice ID
   * @param {Object} options - Analytics options
   * @param {Object} user - Requesting user
   * @param {Object} context - Request context
   * @returns {Object} - Analytics data
   */
  async getNoticeAnalytics(noticeId, options = {}, user, context = {}) {
    try {
      console.log(`📊 Getting analytics for notice ID: ${noticeId}`);

      // Step 1: Find notice
      const notice = await Notice.findById(noticeId);
      if (!notice) {
        return {
          success: false,
          reason: 'notice_not_found',
          message: 'Notice not found'
        };
      }

      // Step 2: Check permissions
      const permissionCheck = await this.checkNoticePermissions(notice, user, 'view_analytics');
      if (!permissionCheck.allowed) {
        return permissionCheck;
      }

      // Step 3: Get analytics data
      const analyticsData = await SiteVisit.getNoticeAnalytics(noticeId, {
        startDate: options.startDate,
        endDate: options.endDate,
        groupBy: options.groupBy || 'day'
      });

      // Step 4: Log analytics access
      await logUserAction(context, 'ANALYTICS_VIEWED', {
        noticeId: notice.id,
        noticeTitle: notice.title,
        analyticsType: 'notice',
        dateRange: {
          start: options.startDate,
          end: options.endDate
        }
      });

      return {
        success: true,
        notice: {
          id: notice.id,
          title: notice.title,
          slug: notice.slug,
          status: notice.status,
          publishedAt: notice.publishedAt
        },
        analytics: analyticsData
      };

    } catch (error) {
      console.error('💥 Notice analytics error:', error.message);
      return {
        success: false,
        reason: 'analytics_error',
        message: 'Failed to get notice analytics'
      };
    }
  }

  /**
   * Record notice view for analytics
   * @param {number} noticeId - Notice ID
   * @param {Object} viewData - View data
   * @returns {Object} - Recording result
   */
  async recordNoticeView(noticeId, viewData = {}) {
    try {
      if (!this.analyticsConfig.trackViews) {
        return { success: true, message: 'View tracking disabled' };
      }

      // Record the visit
      await SiteVisit.recordVisit({
        noticeId: noticeId,
        ipAddress: viewData.ipAddress,
        userAgent: viewData.userAgent,
        referer: viewData.referer,
        sessionId: viewData.sessionId,
        country: viewData.country,
        city: viewData.city
      });

      return { success: true };

    } catch (error) {
      console.error('💥 Notice view recording error:', error.message);
      return {
        success: false,
        reason: 'recording_error',
        message: 'Failed to record notice view'
      };
    }
  }

  /**
   * Validate notice data
   * @param {Object} noticeData - Notice data to validate
   * @param {string} operation - Operation type (create/update)
   * @returns {Object} - Validation result
   */
  async validateNoticeData(noticeData, operation = 'create') {
    try {
      const errors = [];
      const sanitizedData = {};

      // Title validation
      if (operation === 'create' || noticeData.title !== undefined) {
        if (!noticeData.title || typeof noticeData.title !== 'string') {
          errors.push('Title is required');
        } else {
          const titleResult = sanitize(noticeData.title, 'text');
          if (!titleResult.safe) {
            errors.push('Title contains invalid characters');
          } else if (titleResult.sanitized.length > this.noticeConfig.maxTitleLength) {
            errors.push(`Title must not exceed ${this.noticeConfig.maxTitleLength} characters`);
          } else if (titleResult.sanitized.length < 5) {
            errors.push('Title must be at least 5 characters long');
          } else {
            sanitizedData.title = titleResult.sanitized;
          }
        }
      }

      // Description validation
      if (operation === 'create' || noticeData.description !== undefined) {
        if (!noticeData.description || typeof noticeData.description !== 'string') {
          errors.push('Description is required');
        } else {
          const descriptionResult = sanitize(noticeData.description, 'richtext');
          if (!descriptionResult.safe) {
            errors.push('Description contains invalid characters');
          } else if (descriptionResult.sanitized.length > this.noticeConfig.maxDescriptionLength) {
            errors.push(`Description must not exceed ${this.noticeConfig.maxDescriptionLength} characters`);
          } else if (descriptionResult.sanitized.length < 10) {
            errors.push('Description must be at least 10 characters long');
          } else {
            sanitizedData.description = descriptionResult.sanitized;
          }
        }
      }

      // Priority validation
      if (noticeData.priority !== undefined) {
        const priorityResult = sanitize(noticeData.priority, 'text');
        if (!this.noticeConfig.validPriorities.includes(priorityResult.sanitized)) {
          errors.push(`Priority must be one of: ${this.noticeConfig.validPriorities.join(', ')}`);
        } else {
          sanitizedData.priority = priorityResult.sanitized;
        }
      }

      // Status validation
      if (noticeData.status !== undefined) {
        const statusResult = sanitize(noticeData.status, 'text');
        if (!this.noticeConfig.validStatuses.includes(statusResult.sanitized)) {
          errors.push(`Status must be one of: ${this.noticeConfig.validStatuses.join(', ')}`);
        } else {
          sanitizedData.status = statusResult.sanitized;
        }
      }

      // Image URL validation
      if (noticeData.imageUrl !== undefined) {
        if (noticeData.imageUrl === null || noticeData.imageUrl === '') {
          sanitizedData.imageUrl = null;
        } else {
          const imageUrlResult = sanitize(noticeData.imageUrl, 'url');
          if (!imageUrlResult.safe) {
            errors.push('Invalid image URL');
          } else {
            sanitizedData.imageUrl = imageUrlResult.sanitized;
          }
        }
      }

      // Files validation
      if (noticeData.files !== undefined) {
        if (!Array.isArray(noticeData.files)) {
          errors.push('Files must be an array');
        } else if (noticeData.files.length > this.noticeConfig.maxFilesPerNotice) {
          errors.push(`Cannot attach more than ${this.noticeConfig.maxFilesPerNotice} files`);
        } else {
          sanitizedData.files = noticeData.files;
        }
      }

      if (errors.length > 0) {
        return {
          valid: false,
          success: false,
          reason: 'validation_failed',
          message: 'Notice data validation failed',
          errors: errors
        };
      }

      return {
        valid: true,
        sanitizedData
      };

    } catch (error) {
      console.error('💥 Notice data validation error:', error.message);
      return {
        valid: false,
        success: false,
        reason: 'validation_error',
        message: 'Failed to validate notice data'
      };
    }
  }

  /**
   * Generate unique slug for notice
   * @param {string} title - Notice title
   * @param {number} excludeId - Notice ID to exclude from uniqueness check
   * @returns {Object} - Slug generation result
   */
  async generateUniqueSlug(title, excludeId = null) {
    try {
      // Generate base slug
      const slugResult = generateSlug(title, this.noticeConfig.slugOptions);
      
      if (!slugResult.success) {
        return {
          success: false,
          reason: 'slug_generation_failed',
          message: 'Failed to generate slug'
        };
      }

      // Check uniqueness
      const checkExists = async (slug) => {
        const existingNotice = await Notice.findBySlug(slug);
        return existingNotice && existingNotice.id !== excludeId;
      };

      const uniqueSlug = await require('../utils/slugGenerator').ensureUnique(
        slugResult.slug,
        checkExists,
        this.noticeConfig.slugOptions
      );

      return {
        success: true,
        slug: uniqueSlug,
        metadata: slugResult.metadata
      };

    } catch (error) {
      console.error('💥 Slug generation error:', error.message);
      return {
        success: false,
        reason: 'slug_error',
        message: 'Failed to generate unique slug'
      };
    }
  }

  /**
   * Validate files attached to notice
   * @param {Array} files - Files to validate
   * @param {Object} context - Request context
   * @returns {Object} - Validation result
   */
  async validateNoticeFiles(files, context = {}) {
    try {
      const validatedFiles = [];
      const errors = [];

      for (const file of files) {
        if (!file.filename || !file.url) {
          errors.push(`Invalid file data: ${file.originalName || 'unknown'}`);
          continue;
        }

        // Basic file info validation
        const fileInfo = {
          filename: file.filename,
          originalName: file.originalName,
          url: file.url,
          size: file.size,
          mimetype: file.mimetype
        };

        validatedFiles.push(fileInfo);
      }

      if (errors.length > 0) {
        return {
          valid: false,
          success: false,
          reason: 'file_validation_failed',
          message: 'File validation failed',
          errors: errors
        };
      }

      return {
        valid: true,
        validatedFiles
      };

    } catch (error) {
      console.error('💥 File validation error:', error.message);
      return {
        valid: false,
        success: false,
        reason: 'file_validation_error',
        message: 'Failed to validate files'
      };
    }
  }

  /**
   * Check notice permissions for user
   * @param {Object} notice - Notice object
   * @param {Object} user - User object
   * @param {string} action - Action to check
   * @returns {Object} - Permission check result
   */
  async checkNoticePermissions(notice, user, action) {
    try {
      // Super admin can do everything
      if (user.isSuperAdmin()) {
        return { allowed: true };
      }

      // Regular admin rules
      if (user.isAdmin()) {
        switch (action) {
          case 'view':
          case 'view_analytics':
            return { allowed: true };
          
          case 'update':
          case 'delete':
          case 'publish':
            // Can only modify own notices or be super admin
            if (notice.createdBy === user.id) {
              return { allowed: true };
            }
            return {
              allowed: false,
              success: false,
              reason: 'insufficient_permissions',
              message: 'You can only modify your own notices'
            };
          
          default:
            return {
              allowed: false,
              success: false,
              reason: 'unknown_action',
              message: 'Unknown action'
            };
        }
      }

      // Non-admin users have no permissions
      return {
        allowed: false,
        success: false,
        reason: 'insufficient_permissions',
        message: 'Insufficient permissions'
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
   * Validate notice for publication
   * @param {Object} notice - Notice object
   * @returns {Object} - Validation result
   */
  async validateNoticeForPublication(notice) {
    try {
      const errors = [];

      // Check required fields
      if (!notice.title || notice.title.trim().length < 5) {
        errors.push('Title must be at least 5 characters long');
      }

      if (!notice.description || notice.description.trim().length < 10) {
        errors.push('Description must be at least 10 characters long');
      }

      if (!notice.priority || !this.noticeConfig.validPriorities.includes(notice.priority)) {
        errors.push('Valid priority is required');
      }

      if (errors.length > 0) {
        return {
          valid: false,
          success: false,
          reason: 'publication_requirements_not_met',
          message: 'Notice does not meet publication requirements',
          errors: errors
        };
      }

      return { valid: true };

    } catch (error) {
      console.error('💥 Publication validation error:', error.message);
      return {
        valid: false,
        success: false,
        reason: 'publication_validation_error',
        message: 'Failed to validate notice for publication'
      };
    }
  }

  /**
   * Validate search query
   * @param {string} query - Search query
   * @returns {Object} - Validation result
   */
  async validateSearchQuery(query) {
    try {
      if (!query || typeof query !== 'string') {
        return {
          valid: false,
          success: false,
          reason: 'invalid_query',
          message: 'Search query is required'
        };
      }

      if (query.trim().length < this.searchConfig.minQueryLength) {
        return {
          valid: false,
          success: false,
          reason: 'query_too_short',
          message: `Search query must be at least ${this.searchConfig.minQueryLength} characters long`
        };
      }

      // Sanitize search query
      const queryResult = sanitize(query, 'search');
      if (!queryResult.safe) {
        return {
          valid: false,
          success: false,
          reason: 'invalid_query_characters',
          message: 'Search query contains invalid characters'
        };
      }

      return {
        valid: true,
        sanitizedQuery: queryResult.sanitized
      };

    } catch (error) {
      console.error('💥 Search query validation error:', error.message);
      return {
        valid: false,
        success: false,
        reason: 'query_validation_error',
        message: 'Failed to validate search query'
      };
    }
  }

  /**
   * Get notice statistics
   * @param {Object} filters - Filter options
   * @returns {Object} - Statistics
   */
  async getNoticeStatistics(filters = {}) {
    try {
      console.log('📊 Getting notice statistics');

      const stats = await Notice.getStatistics(filters);

      return {
        success: true,
        statistics: stats
      };

    } catch (error) {
      console.error('💥 Notice statistics error:', error.message);
      return {
        success: false,
        reason: 'statistics_error',
        message: 'Failed to get notice statistics'
      };
    }
  }
}

// Create singleton instance
const noticeService = new NoticeService();

module.exports = noticeService;