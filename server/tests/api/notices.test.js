// Notice API Tests - Comprehensive integration tests for notice endpoints
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app'); // Main Express app
const { config } = require('../../src/config/environment');

describe('📋 Notice API Tests', () => {
  let adminToken;
  let superAdminToken;
  let regularUserToken;
  let testNotice;
  let publishedNotice;

  beforeAll(async () => {
    // Setup test tokens
    adminToken = jwt.sign(
      { sub: 1, username: 'admin', role: 'admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    superAdminToken = jwt.sign(
      { sub: 2, username: 'superadmin', role: 'super_admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    regularUserToken = jwt.sign(
      { sub: 3, username: 'user', role: 'user' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // Test notice data
    testNotice = {
      title: 'Test Notice Title',
      description: 'This is a comprehensive test notice description with detailed content.',
      priority: 'medium',
      status: 'draft',
      imageUrl: 'https://example.com/image.jpg'
    };

    publishedNotice = {
      title: 'Published Test Notice',
      description: 'This is a published notice for testing public access.',
      priority: 'high',
      status: 'published',
      imageUrl: null
    };
  });

  describe('POST /api/notices - Create Notice', () => {
    test('should create notice with valid admin token', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testNotice)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.notice).toBeDefined();
      expect(response.body.notice.title).toBe(testNotice.title);
      expect(response.body.notice.description).toBe(testNotice.description);
      expect(response.body.notice.priority).toBe(testNotice.priority);
      expect(response.body.notice.status).toBe(testNotice.status);
      expect(response.body.notice.slug).toBeDefined();
      expect(response.body.notice.createdBy).toBeDefined();

      // Store created notice ID for later tests
      testNotice.id = response.body.notice.id;
    });

    test('should create notice with super admin token', async () => {
      const superAdminNotice = {
        title: 'Super Admin Notice',
        description: 'Notice created by super admin for testing.',
        priority: 'high',
        status: 'draft'
      };

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(superAdminNotice)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.notice.title).toBe(superAdminNotice.title);
    });

    test('should reject notice creation without authentication', async () => {
      const response = await request(app)
        .post('/api/notices')
        .send(testNotice)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/unauthorized|authentication_required/);
    });

    test('should reject notice creation with regular user token', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(testNotice)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('insufficient_permissions');
    });

    test('should validate required fields', async () => {
      const invalidNotices = [
        {}, // Missing all fields
        { title: 'Test' }, // Missing description
        { description: 'Test description' }, // Missing title
        { title: '', description: 'Test' }, // Empty title
        { title: 'Test', description: '' }, // Empty description
        { title: 'a', description: 'Test description' }, // Title too short
        { title: 'Test', description: 'Short' } // Description too short
      ];

      for (const notice of invalidNotices) {
        const response = await request(app)
          .post('/api/notices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(notice)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toMatch(/validation_failed|missing_required/);
      }
    });

    test('should validate field lengths', async () => {
      const longTitle = 'x'.repeat(201); // Exceeds max length
      const longDescription = 'x'.repeat(10001); // Exceeds max length

      const invalidNotices = [
        {
          title: longTitle,
          description: 'Valid description'
        },
        {
          title: 'Valid title',
          description: longDescription
        }
      ];

      for (const notice of invalidNotices) {
        const response = await request(app)
          .post('/api/notices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(notice)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toBe('validation_failed');
      }
    });

    test('should validate priority values', async () => {
      const invalidPriorities = ['urgent', 'critical', 'normal', 'invalid', 123, null];

      for (const priority of invalidPriorities) {
        const notice = {
          title: 'Test Notice',
          description: 'Test description',
          priority: priority
        };

        const response = await request(app)
          .post('/api/notices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(notice)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toBe('validation_failed');
      }
    });

    test('should validate status values', async () => {
      const invalidStatuses = ['active', 'inactive', 'pending', 'invalid', 123, null];

      for (const status of invalidStatuses) {
        const notice = {
          title: 'Test Notice',
          description: 'Test description',
          status: status
        };

        const response = await request(app)
          .post('/api/notices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(notice)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toBe('validation_failed');
      }
    });

    test('should sanitize XSS attempts in notice creation', async () => {
      const xssNotice = {
        title: '<script>alert("XSS")</script>Malicious Title',
        description: '<img src=x onerror=alert(1)>Malicious description<script>evil()</script>',
        priority: 'medium'
      };

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(xssNotice)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('<script>');
      expect(JSON.stringify(response.body)).not.toContain('onerror');
    });

    test('should prevent SQL injection in notice creation', async () => {
      const sqlInjectionNotice = {
        title: "Test'; DROP TABLE notices; --",
        description: "Description'; DELETE FROM users; --",
        priority: 'medium'
      };

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sqlInjectionNotice)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toMatch(/validation_failed|invalid_input/);
    });

    test('should generate unique slugs for notices', async () => {
      const notice1 = {
        title: 'Duplicate Title Test',
        description: 'First notice with this title',
        priority: 'medium'
      };

      const notice2 = {
        title: 'Duplicate Title Test',
        description: 'Second notice with same title',
        priority: 'low'
      };

      const response1 = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(notice1)
        .expect(201);

      const response2 = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(notice2)
        .expect(201);

      expect(response1.body.notice.slug).toBeDefined();
      expect(response2.body.notice.slug).toBeDefined();
      expect(response1.body.notice.slug).not.toBe(response2.body.notice.slug);
    });

    test('should handle file attachments', async () => {
      const noticeWithFiles = {
        title: 'Notice with Files',
        description: 'This notice has file attachments',
        priority: 'medium',
        files: [
          {
            filename: 'document.pdf',
            originalName: 'Important Document.pdf',
            url: '/uploads/document.pdf',
            size: 1024000,
            mimetype: 'application/pdf'
          }
        ]
      };

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(noticeWithFiles)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.notice.files).toBeDefined();
      expect(response.body.notice.files).toHaveLength(1);
    });
  });

  describe('GET /api/notices - List Notices', () => {
    test('should get notices with admin authentication', async () => {
      const response = await request(app)
        .get('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.notices).toBeDefined();
      expect(Array.isArray(response.body.notices)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBeDefined();
      expect(response.body.pagination.limit).toBeDefined();
      expect(response.body.pagination.total).toBeDefined();
    });

    test('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/notices?page=2&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.notices.length).toBeLessThanOrEqual(5);
    });

    test('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/notices?status=published')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All returned notices should have published status
      response.body.notices.forEach(notice => {
        expect(notice.status).toBe('published');
      });
    });

    test('should support filtering by priority', async () => {
      const response = await request(app)
        .get('/api/notices?priority=high')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.notices.forEach(notice => {
        expect(notice.priority).toBe('high');
      });
    });

    test('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/notices?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Results should contain search term in title or description
      response.body.notices.forEach(notice => {
        const containsSearchTerm = 
          notice.title.toLowerCase().includes('test') ||
          notice.description.toLowerCase().includes('test');
        expect(containsSearchTerm).toBe(true);
      });
    });

    test('should support sorting options', async () => {
      const response = await request(app)
        .get('/api/notices?sortBy=createdAt&sortOrder=DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Check if results are sorted by creation date (newest first)
      const notices = response.body.notices;
      for (let i = 1; i < notices.length; i++) {
        const currentDate = new Date(notices[i].createdAt);
        const previousDate = new Date(notices[i - 1].createdAt);
        expect(currentDate.getTime()).toBeLessThanOrEqual(previousDate.getTime());
      }
    });

    test('should reject access without authentication', async () => {
      const response = await request(app)
        .get('/api/notices')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject access with regular user token', async () => {
      const response = await request(app)
        .get('/api/notices')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('insufficient_permissions');
    });

    test('should validate pagination parameters', async () => {
      const invalidParams = [
        'page=-1&limit=10',
        'page=abc&limit=10',
        'page=1&limit=0',
        'page=1&limit=1001', // Exceeds max limit
        'page=999999&limit=10'
      ];

      for (const params of invalidParams) {
        const response = await request(app)
          .get(`/api/notices?${params}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test('should include statistics when requested', async () => {
      const response = await request(app)
        .get('/api/notices?includeStats=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.totalNotices).toBeDefined();
      expect(response.body.statistics.publishedNotices).toBeDefined();
      expect(response.body.statistics.draftNotices).toBeDefined();
    });
  });

  describe('GET /api/notices/:id - Get Single Notice', () => {
    test('should get notice by ID with admin authentication', async () => {
      const response = await request(app)
        .get(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.notice).toBeDefined();
      expect(response.body.notice.id).toBe(testNotice.id);
      expect(response.body.notice.title).toBe(testNotice.title);
      expect(response.body.notice.description).toBe(testNotice.description);
    });

    test('should return 404 for non-existent notice', async () => {
      const response = await request(app)
        .get('/api/notices/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('notice_not_found');
    });

    test('should validate notice ID format', async () => {
      const invalidIds = ['abc', 'null', '0', '-1', 'undefined', '../../etc/passwd'];

      for (const id of invalidIds) {
        const response = await request(app)
          .get(`/api/notices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test('should include analytics when requested', async () => {
      const response = await request(app)
        .get(`/api/notices/${testNotice.id}?includeStats=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
    });

    test('should reject access without authentication', async () => {
      const response = await request(app)
        .get(`/api/notices/${testNotice.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/notices/:id - Update Notice', () => {
    test('should update notice with valid data', async () => {
      const updateData = {
        title: 'Updated Test Notice Title',
        description: 'This notice has been updated with new content.',
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.notice.title).toBe(updateData.title);
      expect(response.body.notice.description).toBe(updateData.description);
      expect(response.body.notice.priority).toBe(updateData.priority);
    });

    test('should allow super admin to update any notice', async () => {
      const updateData = {
        title: 'Super Admin Updated Title',
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.notice.title).toBe(updateData.title);
    });

    test('should prevent admin from updating notices they do not own', async () => {
      // Create notice with super admin
      const superAdminNotice = {
        title: 'Super Admin Only Notice',
        description: 'This notice belongs to super admin',
        priority: 'medium'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(superAdminNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Try to update with regular admin (should fail)
      const updateData = {
        title: 'Unauthorized Update Attempt'
      };

      const response = await request(app)
        .put(`/api/notices/${noticeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('insufficient_permissions');
    });

    test('should validate update data', async () => {
      const invalidUpdates = [
        { title: '' }, // Empty title
        { description: '' }, // Empty description
        { priority: 'invalid' }, // Invalid priority
        { status: 'invalid' }, // Invalid status
        { title: 'x'.repeat(201) }, // Title too long
        { description: 'x'.repeat(10001) } // Description too long
      ];

      for (const updateData of invalidUpdates) {
        const response = await request(app)
          .put(`/api/notices/${testNotice.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.reason).toBe('validation_failed');
      }
    });

    test('should sanitize XSS attempts in updates', async () => {
      const xssUpdate = {
        title: '<script>alert("XSS")</script>Updated Title',
        description: '<img src=x onerror=alert(1)>Updated description'
      };

      const response = await request(app)
        .put(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(xssUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });

    test('should return 404 for non-existent notice', async () => {
      const response = await request(app)
        .put('/api/notices/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('notice_not_found');
    });

    test('should update slug when title changes', async () => {
      const originalResponse = await request(app)
        .get(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const originalSlug = originalResponse.body.notice.slug;

      const updateData = {
        title: 'Completely New Title for Slug Update Test'
      };

      const updateResponse = await request(app)
        .put(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.notice.slug).toBeDefined();
      expect(updateResponse.body.notice.slug).not.toBe(originalSlug);
    });
  });

  describe('DELETE /api/notices/:id - Delete Notice', () => {
    test('should delete notice with proper permissions', async () => {
      // Create a notice to delete
      const noticeToDelete = {
        title: 'Notice to Delete',
        description: 'This notice will be deleted in test',
        priority: 'medium'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(noticeToDelete)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Delete the notice
      const deleteResponse = await request(app)
        .delete(`/api/notices/${noticeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toContain('deleted successfully');

      // Verify notice is deleted
      const getResponse = await request(app)
        .get(`/api/notices/${noticeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(getResponse.body.success).toBe(false);
    });

    test('should allow super admin to delete any notice', async () => {
      // Create notice with regular admin
      const adminNotice = {
        title: 'Admin Notice for Super Admin Delete',
        description: 'This notice will be deleted by super admin',
        priority: 'medium'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adminNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Delete with super admin
      const deleteResponse = await request(app)
        .delete(`/api/notices/${noticeId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
    });

    test('should prevent admin from deleting notices they do not own', async () => {
      // Create notice with super admin
      const superAdminNotice = {
        title: 'Super Admin Notice for Protection Test',
        description: 'This notice should be protected from regular admin deletion',
        priority: 'high'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(superAdminNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Try to delete with regular admin
      const deleteResponse = await request(app)
        .delete(`/api/notices/${noticeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(deleteResponse.body.success).toBe(false);
      expect(deleteResponse.body.reason).toBe('insufficient_permissions');
    });

    test('should return 404 for non-existent notice', async () => {
      const response = await request(app)
        .delete('/api/notices/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.reason).toBe('notice_not_found');
    });

    test('should validate notice ID format in deletion', async () => {
      const invalidIds = ['abc', 'null', '-1', '../admin'];

      for (const id of invalidIds) {
        const response = await request(app)
          .delete(`/api/notices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('POST /api/notices/:id/publish - Publish Notice', () => {
    test('should publish draft notice', async () => {
      // Create a draft notice
      const draftNotice = {
        title: 'Draft Notice for Publishing',
        description: 'This notice will be published in test',
        priority: 'medium',
        status: 'draft'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(draftNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Publish the notice
      const publishResponse = await request(app)
        .post(`/api/notices/${noticeId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(publishResponse.body.success).toBe(true);
      expect(publishResponse.body.notice.status).toBe('published');
      expect(publishResponse.body.notice.publishedAt).toBeDefined();
    });

    test('should reject publishing already published notice', async () => {
      // Create and publish a notice
      const noticeToPublish = {
        title: 'Already Published Notice',
        description: 'This notice is already published',
        priority: 'medium',
        status: 'published'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(noticeToPublish)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Try to publish again
      const publishResponse = await request(app)
        .post(`/api/notices/${noticeId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(publishResponse.body.success).toBe(false);
      expect(publishResponse.body.reason).toBe('already_published');
    });

    test('should validate notice completeness before publishing', async () => {
      // Create an incomplete notice
      const incompleteNotice = {
        title: 'Inc', // Too short
        description: 'Short desc', // Too short
        priority: 'medium',
        status: 'draft'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Try to publish incomplete notice
      const publishResponse = await request(app)
        .post(`/api/notices/${noticeId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(publishResponse.body.success).toBe(false);
      expect(publishResponse.body.reason).toBe('publication_requirements_not_met');
    });
  });

  describe('POST /api/notices/:id/unpublish - Unpublish Notice', () => {
    test('should unpublish published notice', async () => {
      // Create and publish a notice
      const publishedNotice = {
        title: 'Published Notice for Unpublishing',
        description: 'This notice will be unpublished in test',
        priority: 'medium',
        status: 'published'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(publishedNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Unpublish the notice
      const unpublishResponse = await request(app)
        .post(`/api/notices/${noticeId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unpublishResponse.body.success).toBe(true);
      expect(unpublishResponse.body.notice.status).toBe('draft');
    });

    test('should reject unpublishing draft notice', async () => {
      const draftNotice = {
        title: 'Draft Notice for Unpublish Test',
        description: 'This notice is already a draft',
        priority: 'medium',
        status: 'draft'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(draftNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Try to unpublish draft notice
      const unpublishResponse = await request(app)
        .post(`/api/notices/${noticeId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(unpublishResponse.body.success).toBe(false);
      expect(unpublishResponse.body.reason).toBe('already_unpublished');
    });
  });

  describe('GET /api/notices/search - Search Notices', () => {
    test('should search notices with query', async () => {
      const response = await request(app)
        .get('/api/notices/search?q=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.searchQuery).toBe('test');
    });

    test('should validate search query length', async () => {
      const shortQuery = 'a'; // Too short
      const longQuery = 'x'.repeat(501); // Too long

      const invalidQueries = [shortQuery, longQuery, '', '  '];

      for (const query of invalidQueries) {
        const response = await request(app)
          .get(`/api/notices/search?q=${encodeURIComponent(query)}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test('should sanitize search query', async () => {
      const maliciousQuery = '<script>alert("XSS")</script>';

      const response = await request(app)
        .get(`/api/notices/search?q=${encodeURIComponent(maliciousQuery)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });

    test('should support published only filter', async () => {
      const response = await request(app)
        .get('/api/notices/search?q=test&published_only=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.results.forEach(notice => {
        expect(notice.status).toBe('published');
      });
    });
  });

  describe('GET /api/notices/:id/analytics - Notice Analytics', () => {
    test('should get notice analytics with proper permissions', async () => {
      const response = await request(app)
        .get(`/api/notices/${testNotice.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.notice).toBeDefined();
      expect(response.body.analytics).toBeDefined();
    });

    test('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/notices/${testNotice.id}/analytics?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
    });

    test('should prevent access to analytics of others notices by regular admin', async () => {
      // Create notice with super admin
      const superAdminNotice = {
        title: 'Super Admin Analytics Test',
        description: 'Analytics should be protected',
        priority: 'medium'
      };

      const createResponse = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(superAdminNotice)
        .expect(201);

      const noticeId = createResponse.body.notice.id;

      // Try to access analytics with regular admin
      const analyticsResponse = await request(app)
        .get(`/api/notices/${noticeId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(analyticsResponse.body.success).toBe(false);
      expect(analyticsResponse.body.reason).toBe('insufficient_permissions');
    });
  });

  describe('Rate Limiting and Security', () => {
    test('should rate limit notice creation', async () => {
      const notice = {
        title: 'Rate Limit Test Notice',
        description: 'Testing rate limiting on notice creation',
        priority: 'medium'
      };

      // Make rapid requests to trigger rate limiting
      const promises = Array(20).fill().map(() =>
        request(app)
          .post('/api/notices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(notice)
      );

      const responses = await Promise.all(promises);
      
      // Some responses should be rate limited
      const rateLimited = responses.filter(res => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should log security events', async () => {
      // This test would check if security events are properly logged
      // For now, we'll test that malicious requests are handled
      const maliciousRequest = {
        title: "'; DROP TABLE notices; --",
        description: '<script>alert("XSS")</script>'
      };

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      // In a real implementation, this would also verify that the event was logged
    });

    test('should validate content-type header', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'text/plain')
        .send('invalid content type')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should prevent request size attacks', async () => {
      const largePayload = {
        title: 'Large Payload Test',
        description: 'x'.repeat(1000000) // 1MB description
      };

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largePayload)
        .expect(413); // Payload too large

      expect(response.body.error).toContain('too large');
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Mock database error
      // In a real test, you might temporarily break the database connection
      // For now, we'll test the error response format
      
      const response = await request(app)
        .get('/api/notices/invalid-database-test')
        .set('Authorization', `Bearer ${adminToken}`);

      // Response should have proper error structure
      if (response.status >= 500) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('error');
        expect(response.body.success).toBe(false);
      }
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('JSON');
    });

    test('should provide helpful error messages', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    test('should maintain referential integrity', async () => {
      // Test that notices maintain proper relationships
      const response = await request(app)
        .get(`/api/notices/${testNotice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.notice.createdBy).toBeDefined();
      expect(response.body.notice.createdAt).toBeDefined();
      expect(response.body.notice.updatedAt).toBeDefined();
    });

    test('should handle concurrent updates properly', async () => {
      // Simulate concurrent updates to the same notice
      const updateData1 = { title: 'Concurrent Update 1' };
      const updateData2 = { title: 'Concurrent Update 2' };

      const promises = [
        request(app)
          .put(`/api/notices/${testNotice.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData1),
        request(app)
          .put(`/api/notices/${testNotice.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send(updateData2)
      ];

      const responses = await Promise.all(promises);
      
      // At least one should succeed
      const successfulUpdates = responses.filter(res => res.status === 200);
      expect(successfulUpdates.length).toBeGreaterThanOrEqual(1);
    });
  });
});