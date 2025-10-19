-- Add airtable_teacher_id column to profiles table
ALTER TABLE public.profiles
ADD COLUMN airtable_teacher_id TEXT;

-- Create classes table for managing teacher classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  airtable_teacher_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on classes table
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can view their own classes
CREATE POLICY "Teachers can view their own classes"
ON public.classes
FOR SELECT
USING (teacher_id = auth.uid());

-- Policy: Teachers can create their own classes
CREATE POLICY "Teachers can create their own classes"
ON public.classes
FOR INSERT
WITH CHECK (teacher_id = auth.uid());

-- Policy: Teachers can update their own classes
CREATE POLICY "Teachers can update their own classes"
ON public.classes
FOR UPDATE
USING (teacher_id = auth.uid());

-- Policy: Teachers can delete their own classes
CREATE POLICY "Teachers can delete their own classes"
ON public.classes
FOR DELETE
USING (teacher_id = auth.uid());