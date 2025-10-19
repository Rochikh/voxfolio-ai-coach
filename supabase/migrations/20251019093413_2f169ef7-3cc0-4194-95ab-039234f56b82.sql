-- Créer une politique pour permettre à l'admin de voir tous les profils
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'contact@rochane.fr'
  )
);

-- Créer une politique pour permettre à l'admin de voir toutes les classes
CREATE POLICY "Admin can view all classes"
ON public.classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'contact@rochane.fr'
  )
);