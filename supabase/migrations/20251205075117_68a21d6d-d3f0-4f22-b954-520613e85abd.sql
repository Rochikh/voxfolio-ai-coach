-- Make the audio-submissions bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'audio-submissions';

-- Create RLS policy for authenticated users to read their uploads
CREATE POLICY "Service role can read all audio files"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'audio-submissions');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-submissions');

-- Allow public uploads (for student workflow without auth)
CREATE POLICY "Public can upload audio files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'audio-submissions');