-- Rendre le bucket audio-submissions public pour permettre l'accès aux fichiers
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio-submissions';