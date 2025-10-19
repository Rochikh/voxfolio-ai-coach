-- Update the trigger to assign 'enseignant' role by default instead of 'apprenant'
-- Since only teachers will sign up through the authentication system

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, prenom, nom)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'prenom',
    NEW.raw_user_meta_data->>'nom'
  );
  
  -- Assign default role (enseignant)
  -- Only teachers authenticate through the system
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'enseignant');
  
  RETURN NEW;
END;
$$;