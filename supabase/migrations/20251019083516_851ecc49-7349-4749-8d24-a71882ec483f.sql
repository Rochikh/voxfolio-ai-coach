-- Drop the overly permissive policy that allows teachers to view all profiles
-- This policy poses a security risk as it allows any teacher to harvest all user emails
DROP POLICY IF EXISTS "Enseignants can view all profiles" ON public.profiles;

-- Keep only the secure policy where users can only view their own profile
-- The existing "Users can view their own profile" policy is sufficient and secure