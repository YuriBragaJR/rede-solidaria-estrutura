-- Shared merchant and volunteer profile details for the mobile app.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('merchant', 'volunteer')),
  responsible_name text NOT NULL,
  phone text NOT NULL,
  business_name text,
  cnpj text,
  cep text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  business_category text,
  pickup_hours text,
  institution_name text,
  cpf_cnpj text,
  service_area text,
  transport text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  details jsonb := NEW.raw_user_meta_data;
BEGIN
  INSERT INTO public.profiles (
    id, role, responsible_name, phone,
    business_name, cnpj, cep, street, street_number, complement, neighborhood,
    business_category, pickup_hours, institution_name, cpf_cnpj, service_area, transport
  ) VALUES (
    NEW.id,
    COALESCE(details ->> 'role', 'volunteer'),
    COALESCE(details ->> 'responsible_name', ''),
    COALESCE(details ->> 'phone', ''),
    NULLIF(details ->> 'business_name', ''),
    NULLIF(details ->> 'cnpj', ''),
    NULLIF(details ->> 'cep', ''),
    NULLIF(details ->> 'street', ''),
    NULLIF(details ->> 'street_number', ''),
    NULLIF(details ->> 'complement', ''),
    NULLIF(details ->> 'neighborhood', ''),
    NULLIF(details ->> 'business_category', ''),
    NULLIF(details ->> 'pickup_hours', ''),
    NULLIF(details ->> 'institution_name', ''),
    NULLIF(details ->> 'cpf_cnpj', ''),
    NULLIF(details ->> 'service_area', ''),
    NULLIF(details ->> 'transport', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();
