-- =============================================================================
-- Migration: add matiere + consignes_evaluation to classes
-- =============================================================================
-- Adds two optional columns to public.classes so each teacher can describe
-- the subject taught and the pedagogical instructions used by the Voxfolio
-- AI pipeline (process-submission Edge Function) to tailor its feedback.
--
--   * matiere               — short subject name (e.g. "Logistique",
--                             "Électricité industrielle", "Maths 1ère STMG").
--   * consignes_evaluation  — free-form text written by the teacher: what the
--                             AI should evaluate, expected technical
--                             vocabulary, points of vigilance, kind of
--                             presentation, etc. No length limit (TEXT).
--
-- Both columns are NULLABLE and have no DEFAULT so existing classes are
-- preserved as-is — teachers fill them in whenever they want from the UI.
--
-- RLS: no change. The columns inherit the existing policies on classes
-- (defined in migration 20251019073443), which restrict every operation to
-- the owning teacher (teacher_id = auth.uid()).
-- =============================================================================

ALTER TABLE public.classes
  ADD COLUMN matiere              TEXT,
  ADD COLUMN consignes_evaluation TEXT;
