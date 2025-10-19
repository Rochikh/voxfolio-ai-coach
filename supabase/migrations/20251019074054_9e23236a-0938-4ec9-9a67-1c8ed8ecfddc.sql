-- Remove airtable_teacher_id column from profiles table (no longer needed)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS airtable_teacher_id;

-- Remove airtable_teacher_id column from classes table (no longer needed)
ALTER TABLE public.classes
DROP COLUMN IF EXISTS airtable_teacher_id;