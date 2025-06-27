-- Simple Notice Management System Database Schema
-- Developer: J33WAKASUPUN 
-- Version: 1.0.0 - Simplified & Secure
-- Created: 2025-06-24

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS site_visits;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS notices;
DROP TABLE IF EXISTS users;

-- ========== USERS TABLE ==========
-- Simple user management: admin + super_admin only
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- bcrypt hashed
  role ENUM('admin', 'super_admin') NOT NULL DEFAULT 'admin',
  full_name VARCHAR(255) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
);

-- ========== NOTICES TABLE ==========
-- Main content table with all features
CREATE TABLE notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  
  -- File storage (simple JSON approach)
  image_url VARCHAR(500) NULL, -- Single main image
  files JSON NULL, -- Array of file objects [{name, url, size, type, originalName}]
  
  -- Status and priority
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  
  -- SEO and sharing
  slug VARCHAR(600) NOT NULL UNIQUE, -- SEO friendly URL
  
  -- Creator tracking
  created_by INT NOT NULL,
  
  -- Publishing
  published_at TIMESTAMP NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_created_by (created_by),
  INDEX idx_published_at (published_at),
  INDEX idx_slug (slug),
  INDEX idx_status_published (status, published_at),
  INDEX idx_created_at (created_at),
  
  -- Full text search on title and description
  FULLTEXT KEY ft_title_description (title, description)
);

-- ========== SITE VISITS TABLE ==========
-- Analytics for public notice viewing
CREATE TABLE site_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notice_id INT NULL, -- NULL for homepage visits
  
  -- Visitor information (anonymous)
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  referer VARCHAR(500),
  
  -- Time tracking
  visit_date DATE NOT NULL,
  visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Session tracking
  session_id VARCHAR(100), -- Track unique sessions
  
  -- Location data (optional)
  country VARCHAR(100),
  city VARCHAR(100),
  
  -- Foreign keys
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE SET NULL,
  
  -- Indexes for analytics
  INDEX idx_notice_visits (notice_id, visit_date),
  INDEX idx_visit_date (visit_date),
  INDEX idx_ip_session (ip_address, session_id),
  INDEX idx_session_time (session_id, visit_time),
  INDEX idx_visit_time (visit_time)
);

-- ========== USER SESSIONS TABLE ==========
-- JWT session tracking for security
CREATE TABLE user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  
  -- Security
  token_hash VARCHAR(255) NOT NULL, -- Hashed JWT for security (don't store plaintext)
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Session management
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Foreign keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_user_token (user_id, token_hash),
  INDEX idx_expires_at (expires_at),
  INDEX idx_user_active (user_id, is_active),
  INDEX idx_last_activity (last_activity)
);

-- ========== INSERT INITIAL DATA ==========

-- Insert admin users (password: admin123 - hashed with bcrypt)
INSERT INTO users (username, email, password, role, full_name) VALUES
('admin', 'admin@ati.ac.lk', '$2a$10$B7PqfjLfJhpRlHXcQVg0GOY6pcqAalvm5HUYuc2yv8JIWNeh98cQu', 'admin', 'System Administrator'),
('superadmin', 'superadmin@ati.ac.lk', '$2a$10$B7PqfjLfJhpRlHXcQVg0GOY6pcqAalvm5HUYuc2yv8JIWNeh98cQu', 'super_admin', 'Super Administrator'),
('j33wakasupun', 'jeewakasupun789@gmail.com', '$2a$10$B7PqfjLfJhpRlHXcQVg0GOY6pcqAalvm5HUYuc2yv8JIWNeh98cQu', 'super_admin', 'Super Administrator');

-- Insert sample notices for testing
INSERT INTO notices (title, description, priority, status, slug, created_by, published_at) VALUES
('Welcome to Simple Notice System', 'This is our first notice in the simplified system. It demonstrates the clean and secure approach we''ve taken.', 'high', 'published', 'welcome-to-simple-notice-system', 1, NOW()),
('System Maintenance Scheduled', 'We will be performing routine maintenance on the system this weekend. Please save your work.', 'medium', 'published', 'system-maintenance-scheduled', 1, NOW()),
('New Features Coming Soon', 'We are working on exciting new features that will be released in the next update. Stay tuned!', 'low', 'draft', 'new-features-coming-soon', 2, NULL);

-- ========== CREATE VIEWS FOR ANALYTICS ==========

-- Simple notice statistics view
CREATE VIEW notice_stats AS
SELECT 
  n.id,
  n.title,
  n.status,
  n.priority,
  n.created_by,
  u.username as creator_username,
  u.full_name as creator_name,
  n.created_at,
  n.published_at,
  COUNT(DISTINCT sv.id) as total_views,
  COUNT(DISTINCT sv.session_id) as unique_visitors,
  COUNT(CASE WHEN sv.visit_date >= CURDATE() - INTERVAL 7 DAY THEN 1 END) as views_last_7_days,
  COUNT(CASE WHEN sv.visit_date >= CURDATE() - INTERVAL 30 DAY THEN 1 END) as views_last_30_days
FROM notices n
LEFT JOIN users u ON n.created_by = u.id
LEFT JOIN site_visits sv ON n.id = sv.notice_id
GROUP BY n.id;

-- Daily analytics view
CREATE VIEW daily_analytics AS
SELECT 
  DATE(sv.visit_time) as visit_date,
  COUNT(*) as total_visits,
  COUNT(DISTINCT sv.session_id) as unique_visitors,
  COUNT(DISTINCT sv.notice_id) as notices_viewed,
  COUNT(CASE WHEN sv.notice_id IS NULL THEN 1 END) as homepage_visits
FROM site_visits sv
WHERE sv.visit_time >= CURDATE() - INTERVAL 30 DAY
GROUP BY DATE(sv.visit_time)
ORDER BY visit_date DESC;

-- Popular notices view
CREATE VIEW popular_notices AS
SELECT 
  n.id,
  n.title,
  n.slug,
  n.status,
  n.published_at,
  COUNT(sv.id) as view_count,
  COUNT(DISTINCT sv.session_id) as unique_viewers
FROM notices n
LEFT JOIN site_visits sv ON n.id = sv.notice_id
WHERE n.status = 'published'
GROUP BY n.id
HAVING view_count > 0
ORDER BY view_count DESC, unique_viewers DESC
LIMIT 10;

-- ========== SUCCESS MESSAGE ==========
SELECT 
  'SUCCESS' as Status,
  'Simple Notice Management Database v1.0.0 - Ready!' as Message,
  '2025-06-24 14:04:15' as Created_At,
  'J33WAKASUPUN' as Developers,
  'Clean, simple, and secure database structure implemented' as Result;