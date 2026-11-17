-- The mobile and web apps currently use the Supabase anon key without user
-- accounts. These policies allow the public donation board to read and reserve
-- donations, and let merchants publish new ones.
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read donations" ON public.donations;
CREATE POLICY "Public can read donations"
  ON public.donations
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can create donations" ON public.donations;
CREATE POLICY "Public can create donations"
  ON public.donations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can reserve donations" ON public.donations;
CREATE POLICY "Public can reserve donations"
  ON public.donations
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
