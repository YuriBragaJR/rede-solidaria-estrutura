-- Nutre web backoffice: roles, account controls and immutable activity history.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'merchant', 'volunteer')),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON auth.users;
CREATE TRIGGER sync_profile_email_trigger AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

CREATE OR REPLACE FUNCTION public.is_nutre_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_nutre_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_nutre_admin() TO authenticated;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_nutre_admin());
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_nutre_admin()) WITH CHECK (public.is_nutre_admin());

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('nutre.allow_admin_bootstrap', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_nutre_admin() AND (
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.is_active IS DISTINCT FROM OLD.is_active OR
    NEW.approval_status IS DISTINCT FROM OLD.approval_status
  ) THEN
    RAISE EXCEPTION 'Only a Nutre administrator can change account permissions';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_privileges_trigger ON public.profiles;
CREATE TRIGGER protect_profile_privileges_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

CREATE OR REPLACE FUNCTION public.mark_ngo_profiles_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'volunteer' AND NULLIF(trim(NEW.institution_name), '') IS NOT NULL THEN
    NEW.approval_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS review_ngo_profiles_trigger ON public.profiles;
CREATE TRIGGER review_ngo_profiles_trigger BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mark_ngo_profiles_pending();

CREATE TABLE IF NOT EXISTS public.system_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_audit_log_happened_at_idx ON public.system_audit_log (happened_at DESC);
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_audit_log FROM anon, authenticated;
GRANT SELECT ON public.system_audit_log TO authenticated;
DROP POLICY IF EXISTS "Admins can read audit log" ON public.system_audit_log;
CREATE POLICY "Admins can read audit log" ON public.system_audit_log
  FOR SELECT TO authenticated USING (public.is_nutre_admin());

CREATE OR REPLACE FUNCTION public.audit_nutre_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  row_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_id := COALESCE(new_row ->> 'id', old_row ->> 'id');
  INSERT INTO public.system_audit_log(actor_id, entity_type, entity_id, action, old_data, new_data)
  VALUES (auth.uid(), TG_TABLE_NAME, row_id, TG_OP, old_row, new_row);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_donations_changes ON public.donations;
CREATE TRIGGER audit_donations_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.audit_nutre_change();
DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
CREATE TRIGGER audit_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_nutre_change();

-- Existing public policies must be removed so they cannot bypass authenticated access.
DROP POLICY IF EXISTS "Public can read donations" ON public.donations;
DROP POLICY IF EXISTS "Public can create donations" ON public.donations;
DROP POLICY IF EXISTS "Public can reserve donations" ON public.donations;
DROP POLICY IF EXISTS "Nutre users can read donations" ON public.donations;
CREATE POLICY "Nutre users can read donations" ON public.donations
  FOR SELECT TO authenticated USING (
    public.is_nutre_admin() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'merchant' AND p.is_active = true AND (merchant_id = auth.uid() OR status = 'disponivel')) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true AND p.approval_status = 'approved' AND (status = 'disponivel' OR reserved_by = auth.uid()))
  );
DROP POLICY IF EXISTS "Merchants and admins can create donations" ON public.donations;
CREATE POLICY "Merchants and admins can create donations" ON public.donations
  FOR INSERT TO authenticated WITH CHECK (
    public.is_nutre_admin() OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.role = 'merchant' AND p.is_active = true
         AND p.approval_status = 'approved' AND merchant_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Nutre users can update donations" ON public.donations;
CREATE POLICY "Nutre users can update donations" ON public.donations
  FOR UPDATE TO authenticated
  USING (
    public.is_nutre_admin() OR
    (merchant_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'merchant' AND p.is_active = true AND p.approval_status = 'approved')) OR
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true AND p.approval_status = 'approved') AND (status = 'disponivel' OR reserved_by = auth.uid()))
  )
  WITH CHECK (
    public.is_nutre_admin() OR
    (merchant_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'merchant' AND p.is_active = true AND p.approval_status = 'approved')) OR
    (reserved_by = auth.uid() AND status IN ('reservado', 'retirado') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true AND p.approval_status = 'approved'))
  );

GRANT SELECT, INSERT, UPDATE ON public.donations TO authenticated;
