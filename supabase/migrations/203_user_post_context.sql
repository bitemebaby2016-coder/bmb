-- Migration 203: user_post_context table for AI context sharing between comment and message
-- Created: 2026-11-11
-- Purpose: Store post context (post_id, post_message) per user (PSID) + page
-- so that Messenger conversations can access the post context from comments

CREATE TABLE user_post_context (
  user_id TEXT NOT NULL,           -- PSID (page-scoped, same for comment+message)
  page_id TEXT NOT NULL,
  post_id TEXT NOT NULL,           -- e.g., '123456789_987654321'
  post_message TEXT NOT NULL,      -- Full post text (for scopeCatalogToPost)
  post_created_at TIMESTAMPTZ,     -- When post was published (from Graph API)
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, page_id)
);

-- Index for cleanup queries (expire old contexts)
CREATE INDEX idx_user_post_context_updated ON user_post_context(updated_at);

-- RLS: service_role only (written by social-ai-worker)
ALTER TABLE user_post_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON user_post_context
  FOR ALL USING (auth.role() = 'service_role');

-- Grant for service role
GRANT ALL ON user_post_context TO service_role;