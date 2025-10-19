-- Supprimer les anciennes politiques qui ne fonctionnent pas
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all classes" ON public.classes;

-- Créer une fonction security definer pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
    AND email = 'contact@rochane.fr'
  )
$$;

-- Créer les bonnes politiques utilisant la fonction
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can view all classes"
ON public.classes
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));