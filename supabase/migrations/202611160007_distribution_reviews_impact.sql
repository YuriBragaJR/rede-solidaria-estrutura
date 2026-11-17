-- Separate pickup from community distribution, and record quality feedback.

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS distribution_note text,
  ADD COLUMN IF NOT EXISTS distribution_photo_url text;

CREATE TABLE IF NOT EXISTS public.donation_reviews (
  donation_id text PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quality_score smallint NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
  quantity_matched boolean NOT NULL,
  food_safe boolean NOT NULL,
  packaging_ok boolean NOT NULL,
  service_cordial boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS donation_reviews_merchant_idx
  ON public.donation_reviews (merchant_id, created_at DESC);
ALTER TABLE public.donation_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donation_reviews FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_pickup_code(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  confirmed_title text;
  confirmed_id text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role IN ('merchant', 'admin') AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Somente o comerciante responsável pode confirmar a retirada';
  END IF;

  UPDATE public.donations d
     SET status = 'em_rota', collected_at = now()
    FROM public.donation_pickup_vouchers v
   WHERE v.donation_id = d.id::text
     AND v.pickup_code = upper(trim(p_code))
     AND d.status = 'reservado'
     AND (public.is_nutre_admin() OR d.merchant_id = auth.uid())
   RETURNING d.title, d.id::text INTO confirmed_title, confirmed_id;

  IF confirmed_title IS NULL THEN
    RAISE EXCEPTION 'Código inválido, expirado ou pertencente a outro estabelecimento';
  END IF;

  DELETE FROM public.donation_pickup_vouchers WHERE donation_id = confirmed_id;
  RETURN confirmed_title;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_donation_review(
  p_donation_id text,
  p_quality_score smallint,
  p_quantity_matched boolean,
  p_food_safe boolean,
  p_packaging_ok boolean,
  p_service_cordial boolean,
  p_comment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  donation_row public.donations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Somente uma conta ativa de ONG ou voluntário pode avaliar';
  END IF;
  IF p_quality_score NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'A nota deve estar entre 1 e 5';
  END IF;

  SELECT d.* INTO donation_row
    FROM public.donations d
   WHERE d.id::text = p_donation_id
     AND d.reserved_by = auth.uid()
     AND d.status IN ('em_rota', 'retirado');
  IF donation_row.id IS NULL THEN
    RAISE EXCEPTION 'Esta coleta não está em rota ou não pertence à sua conta';
  END IF;

  INSERT INTO public.donation_reviews (
    donation_id, merchant_id, volunteer_id, quality_score,
    quantity_matched, food_safe, packaging_ok, service_cordial, comment
  ) VALUES (
    donation_row.id::text, donation_row.merchant_id, auth.uid(), p_quality_score,
    p_quantity_matched, p_food_safe, p_packaging_ok, p_service_cordial,
    NULLIF(trim(p_comment), '')
  );
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Esta doação já foi avaliada';
END;
$$;

DROP FUNCTION IF EXISTS public.complete_donation_distribution(text, text, text);
CREATE OR REPLACE FUNCTION public.complete_donation_distribution(
  p_donation_id text,
  p_note text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_people_served integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_id text;
BEGIN
  IF p_people_served IS NOT NULL AND p_people_served < 0 THEN
    RAISE EXCEPTION 'O número de pessoas atendidas não pode ser negativo';
  END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Somente a ONG ou pessoa voluntária responsável pode concluir a distribuição';
  END IF;

  UPDATE public.donations d
     SET status = 'retirado', completed_at = now(),
         distribution_note = NULLIF(trim(p_note), ''),
         distribution_photo_url = NULLIF(trim(p_photo_url), ''),
         people_served = COALESCE(p_people_served, d.people_served)
   WHERE d.id::text = p_donation_id
     AND d.reserved_by = auth.uid()
     AND d.status = 'em_rota'
   RETURNING d.id::text INTO completed_id;
  IF completed_id IS NULL THEN
    RAISE EXCEPTION 'Esta doação não está em rota ou não pertence à sua conta';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_donor_reputations(p_merchant_ids uuid[])
RETURNS TABLE (
  merchant_id uuid,
  average_rating numeric,
  review_count integer,
  donor_gold boolean,
  safety_flags integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(ROUND(AVG(r.quality_score)::numeric, 1), 0),
         COUNT(r.donation_id)::integer,
         (COUNT(r.donation_id) >= 5 AND AVG(r.quality_score) >= 4.7
           AND COUNT(*) FILTER (WHERE r.food_safe = false) = 0),
         COUNT(*) FILTER (WHERE r.food_safe = false)::integer
    FROM public.profiles p
    LEFT JOIN public.donation_reviews r ON r.merchant_id = p.id
   WHERE p.role = 'merchant' AND p.id = ANY(p_merchant_ids)
   GROUP BY p.id;
$$;

DROP FUNCTION IF EXISTS public.get_my_reserved_donations();
CREATE FUNCTION public.get_my_reserved_donations()
RETURNS TABLE (
  donation_id text,
  title text,
  description text,
  quantity text,
  category text,
  status text,
  pickup_deadline timestamptz,
  photo_url text,
  pickup_code text,
  estimated_weight_kg numeric,
  business_name text,
  merchant_phone text,
  cep text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  pickup_hours text,
  has_review boolean,
  distribution_note text,
  distribution_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true
  ) THEN
    RETURN;
  END IF;

  PERFORM public.release_expired_donations();
  RETURN QUERY
  SELECT d.id::text, d.title::text, d.description::text, d.quantity::text,
         d.category::text, d.status::text, d.pickup_deadline, d.photo_url,
         v.pickup_code, d.estimated_weight_kg, p.business_name, p.phone,
         p.cep, p.street, p.street_number, p.complement, p.neighborhood,
         p.pickup_hours, (r.donation_id IS NOT NULL), d.distribution_note,
         d.distribution_photo_url
    FROM public.donations d
    LEFT JOIN public.profiles p ON p.id = d.merchant_id
    LEFT JOIN public.donation_pickup_vouchers v ON v.donation_id = d.id::text
    LEFT JOIN public.donation_reviews r ON r.donation_id = d.id::text
   WHERE d.reserved_by = auth.uid()
   ORDER BY d.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_donation_review(text, smallint, boolean, boolean, boolean, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_donation_distribution(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_donor_reputations(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_reserved_donations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_donation_review(text, smallint, boolean, boolean, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_donation_distribution(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_donor_reputations(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_reserved_donations() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'donations'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
  END IF;
END;
$$;
