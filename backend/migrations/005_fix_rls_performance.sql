-- Fix RLS performance issues and duplicate policies
-- Run in Supabase SQL Editor

-- ============================================
-- 1. Fix drafts table RLS policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own drafts" ON drafts;
DROP POLICY IF EXISTS "Users can create own drafts" ON drafts;
DROP POLICY IF EXISTS "Users can update own drafts" ON drafts;
DROP POLICY IF EXISTS "Users can delete own drafts" ON drafts;

-- Recreate with optimized (select auth.uid())
CREATE POLICY "Users can view own drafts" ON drafts
    FOR SELECT USING (user_id = (select auth.uid()::text));

CREATE POLICY "Users can create own drafts" ON drafts
    FOR INSERT WITH CHECK (user_id = (select auth.uid()::text));

CREATE POLICY "Users can update own drafts" ON drafts
    FOR UPDATE USING (user_id = (select auth.uid()::text));

CREATE POLICY "Users can delete own drafts" ON drafts
    FOR DELETE USING (user_id = (select auth.uid()::text));

-- ============================================
-- 2. Fix scheduled_posts table RLS policies
-- ============================================

-- Drop ALL existing policies (including duplicates)
DROP POLICY IF EXISTS "Users can view own scheduled_posts" ON scheduled_posts;
DROP POLICY IF EXISTS "Users can create own scheduled_posts" ON scheduled_posts;
DROP POLICY IF EXISTS "Users can update own scheduled_posts" ON scheduled_posts;
DROP POLICY IF EXISTS "Users can delete own scheduled_posts" ON scheduled_posts;
DROP POLICY IF EXISTS "Users can manage own posts" ON scheduled_posts;
DROP POLICY IF EXISTS "Service role full access" ON scheduled_posts;

-- Recreate with single optimized policy per action
CREATE POLICY "Users can view own scheduled_posts" ON scheduled_posts
    FOR SELECT USING (
        user_id = (select auth.uid()::text)
        OR (select auth.role()) = 'service_role'
    );

CREATE POLICY "Users can create own scheduled_posts" ON scheduled_posts
    FOR INSERT WITH CHECK (
        user_id = (select auth.uid()::text)
        OR (select auth.role()) = 'service_role'
    );

CREATE POLICY "Users can update own scheduled_posts" ON scheduled_posts
    FOR UPDATE USING (
        user_id = (select auth.uid()::text)
        OR (select auth.role()) = 'service_role'
    );

CREATE POLICY "Users can delete own scheduled_posts" ON scheduled_posts
    FOR DELETE USING (
        user_id = (select auth.uid()::text)
        OR (select auth.role()) = 'service_role'
    );

-- ============================================
-- 3. Fix sync_metadata table RLS policy
-- ============================================

DROP POLICY IF EXISTS "Users can manage own sync_metadata" ON sync_metadata;

CREATE POLICY "Users can manage own sync_metadata" ON sync_metadata
    FOR ALL USING (user_id = (select auth.uid()::text))
    WITH CHECK (user_id = (select auth.uid()::text));

-- ============================================
-- 4. Remove duplicate index
-- ============================================

DROP INDEX IF EXISTS scheduled_posts_user_id_idx;
-- Keep idx_scheduled_posts_user_id

-- ============================================
-- 5. Fix function search_path (security)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
