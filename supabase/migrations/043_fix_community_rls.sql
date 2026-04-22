-- Migration 043: tighten RLS for community_posts + community_reactions
-- Covers Cowork review group 9 mediums #8, #9, #10.
-- Existing policies (from 012_review_system) being replaced:
--   * "Anyone view reactions" on community_reactions  (over-permissive — drop)
--   * "Users view cohort posts" on community_posts    (drops the public branch)
-- Adds owner UPDATE/DELETE on community_posts.

-- ============================================================
-- M8 — gate reaction reads to users in the same cohort as the post,
--      plus the post owner themselves (always allowed to see reactions
--      on their own post even if they leave the cohort).
-- ============================================================
DROP POLICY IF EXISTS "Anyone view reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "select_reactions"      ON public.community_reactions;
DROP POLICY IF EXISTS "select_reactions_cohort" ON public.community_reactions;

CREATE POLICY "select_reactions_cohort" ON public.community_reactions
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.community_posts cp
    JOIN public.enrollments e ON e.cohort_id = cp.cohort_id
    WHERE cp.id = community_reactions.post_id
      AND e.user_id = auth.uid()
      AND e.status IN ('active', 'completed')
  )
  OR EXISTS (
    SELECT 1
    FROM public.community_posts cp
    WHERE cp.id = community_reactions.post_id
      AND cp.user_id = auth.uid()
  )
);

-- ============================================================
-- M9 — drop the `cohort_id IS NULL` (public posts) branch from the
--      SELECT policy on community_posts. App does not surface public
--      posts; the branch was permitting cross-cohort reads.
-- ============================================================
DROP POLICY IF EXISTS "Users view cohort posts" ON public.community_posts;

CREATE POLICY "Users view cohort posts" ON public.community_posts
FOR SELECT USING (
  is_hidden = false
  AND cohort_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE enrollments.cohort_id = community_posts.cohort_id
      AND enrollments.user_id   = auth.uid()
      AND enrollments.status IN ('active', 'completed')
  )
);

-- ============================================================
-- M10 — owner can edit / delete their own posts.
--       Insert policy "Users create posts" already exists (012).
-- ============================================================
DROP POLICY IF EXISTS "update_own_posts" ON public.community_posts;
DROP POLICY IF EXISTS "delete_own_posts" ON public.community_posts;

CREATE POLICY "update_own_posts" ON public.community_posts
FOR UPDATE
USING      (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_posts" ON public.community_posts
FOR DELETE USING (auth.uid() = user_id);
