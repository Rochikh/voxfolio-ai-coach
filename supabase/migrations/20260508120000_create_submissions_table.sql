-- =============================================================================
-- Migration: create submissions table
-- =============================================================================
-- Replaces Airtable as the storage layer for student voice submissions and
-- their AI-generated feedback (Groq Whisper transcription + OpenRouter
-- feedback + generated avatar).
--
-- V1 design notes:
--   * Students are NOT authenticated. They type their name into a form, so we
--     store `student_name` as plain TEXT and have no FK to profiles/auth.users.
--   * All writes (INSERT/UPDATE/DELETE) go through Edge Functions using the
--     service_role key, which bypasses RLS. The client never writes directly.
--   * RLS therefore only exposes SELECT access — to the owning teacher (via
--     the class) and to the admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name  TEXT NOT NULL,
  class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  audio_path    TEXT NOT NULL,
  transcription TEXT,
  feedback      JSONB,
  avatar_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. RLS Policies (SELECT only — writes go through service_role)
-- -----------------------------------------------------------------------------

-- A teacher can read submissions that belong to a class they own.
-- The link is submissions.class_id -> classes.id, with classes.teacher_id
-- matching the authenticated user.
CREATE POLICY "Teachers can view submissions of their classes"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classes
      WHERE classes.id = submissions.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- The admin (contact@rochane.fr) can read every submission. Uses the existing
-- security-definer helper public.is_admin() introduced in migration
-- 20251019093413 so we don't expose auth.users to the policy directly.
CREATE POLICY "Admins can view all submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. updated_at trigger
-- -----------------------------------------------------------------------------
-- Reuses the existing public.handle_updated_at() function (defined in
-- migration 20251019071153, SECURITY DEFINER, search_path = public).
CREATE TRIGGER set_updated_at_submissions
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_submissions_class_id   ON public.submissions (class_id);
CREATE INDEX idx_submissions_status     ON public.submissions (status);
CREATE INDEX idx_submissions_created_at ON public.submissions (created_at DESC);
