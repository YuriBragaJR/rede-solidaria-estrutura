-- Mobile app fields used by role-aware tabs, donation photos and action history.
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS merchant_neighborhood text,
  ADD COLUMN IF NOT EXISTS pickup_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS people_served integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_weight_kg numeric(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS donations_merchant_id_idx ON public.donations (merchant_id);
CREATE INDEX IF NOT EXISTS donations_reserved_by_idx ON public.donations (reserved_by);
CREATE INDEX IF NOT EXISTS donations_status_created_idx ON public.donations (status, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('donation-photos', 'donation-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can read donation photos" ON storage.objects;
CREATE POLICY "Public can read donation photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'donation-photos');

DROP POLICY IF EXISTS "Authenticated users can upload donation photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload donation photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'donation-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their donation photos" ON storage.objects;
CREATE POLICY "Users can update their donation photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'donation-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'donation-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their donation photos" ON storage.objects;
CREATE POLICY "Users can delete their donation photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'donation-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.get_my_reserved_donations()
RETURNS TABLE (
  donation_id text,
  title text,
  description text,
  quantity text,
  category text,
  status text,
  pickup_deadline timestamptz,
  photo_url text,
  business_name text,
  cep text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  pickup_hours text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id::text,
         d.title::text,
         d.description::text,
         d.quantity::text,
         d.category::text,
         d.status::text,
         d.pickup_deadline,
         d.photo_url,
         p.business_name,
         p.cep,
         p.street,
         p.street_number,
         p.complement,
         p.neighborhood,
         p.pickup_hours
    FROM public.donations AS d
    LEFT JOIN public.profiles AS p ON p.id = d.merchant_id
   WHERE d.reserved_by = auth.uid()
     AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_reserved_donations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reserved_donations() TO authenticated;
