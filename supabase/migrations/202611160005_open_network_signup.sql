-- Keep signup open for merchants, NGOs and independent volunteers.
-- NGO verification must not block access to available donations.

DROP TRIGGER IF EXISTS review_ngo_profiles_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.mark_ngo_profiles_pending();

-- Profiles created before this migration were marked pending by the old trigger.
-- The privilege guard allows this one-time migration update through this local flag.
DO $$
BEGIN
  PERFORM set_config('nutre.allow_admin_bootstrap', 'on', true);
  UPDATE public.profiles
     SET approval_status = 'approved'
   WHERE approval_status <> 'approved';
END;
$$;

DROP POLICY IF EXISTS "Nutre users can read donations" ON public.donations;
CREATE POLICY "Nutre users can read donations" ON public.donations
  FOR SELECT TO authenticated USING (
    public.is_nutre_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.role = 'merchant' AND p.is_active = true
         AND (donations.merchant_id = auth.uid() OR donations.status = 'disponivel')
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true
         AND (donations.status = 'disponivel' OR donations.reserved_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Merchants and admins can create donations" ON public.donations;
CREATE POLICY "Merchants and admins can create donations" ON public.donations
  FOR INSERT TO authenticated WITH CHECK (
    public.is_nutre_admin() OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.role = 'merchant' AND p.is_active = true
         AND donations.merchant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Nutre users can update donations" ON public.donations;
CREATE POLICY "Nutre users can update donations" ON public.donations
  FOR UPDATE TO authenticated
  USING (
    public.is_nutre_admin() OR
    (donations.merchant_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
        AND p.role = 'merchant' AND p.is_active = true
    )) OR
    (EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
        AND p.role = 'volunteer' AND p.is_active = true
    ) AND (donations.status = 'disponivel' OR donations.reserved_by = auth.uid()))
  )
  WITH CHECK (
    public.is_nutre_admin() OR
    (donations.merchant_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
        AND p.role = 'merchant' AND p.is_active = true
    )) OR
    (donations.reserved_by = auth.uid() AND donations.status IN ('reservado', 'retirado') AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
        AND p.role = 'volunteer' AND p.is_active = true
    ))
  );
