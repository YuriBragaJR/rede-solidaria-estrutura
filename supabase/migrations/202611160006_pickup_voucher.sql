-- Secure pickup vouchers: generate the code in the database, and let only the
-- owning merchant validate it. No client can directly change donation status.

CREATE TABLE IF NOT EXISTS public.donation_pickup_vouchers (
  donation_id text PRIMARY KEY,
  pickup_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donation_pickup_vouchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donation_pickup_vouchers FROM PUBLIC, anon, authenticated;

INSERT INTO public.donation_pickup_vouchers (donation_id, pickup_code)
SELECT d.id::text, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  FROM public.donations d
 WHERE d.status = 'reservado' AND d.reserved_by IS NOT NULL
ON CONFLICT (donation_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.release_expired_donations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.is_active = true
       AND p.role IN ('merchant', 'volunteer', 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  DELETE FROM public.donation_pickup_vouchers v
   USING public.donations d
   WHERE v.donation_id = d.id::text
     AND d.status = 'reservado'
     AND d.pickup_deadline IS NOT NULL
     AND d.pickup_deadline <= now();

  UPDATE public.donations
     SET status = 'disponivel', reserved_by = NULL
   WHERE status = 'reservado'
     AND pickup_deadline IS NOT NULL
     AND pickup_deadline <= now();
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_donation(p_donation_id text)
RETURNS TABLE (pickup_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_code text;
  reserved_id text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'volunteer' AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Somente pessoas com conta ativa de recepção podem reservar doações';
  END IF;

  PERFORM public.release_expired_donations();
  UPDATE public.donations d
     SET status = 'reservado', reserved_by = auth.uid()
   WHERE d.id::text = p_donation_id AND d.status = 'disponivel'
   RETURNING d.id::text INTO reserved_id;

  IF reserved_id IS NULL THEN
    RAISE EXCEPTION 'Esta doação não está mais disponível';
  END IF;

  LOOP
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.donation_pickup_vouchers v WHERE v.pickup_code = generated_code
    );
  END LOOP;
  INSERT INTO public.donation_pickup_vouchers (donation_id, pickup_code)
  VALUES (reserved_id, generated_code);

  RETURN QUERY SELECT generated_code;
END;
$$;

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
     SET status = 'retirado', completed_at = now()
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

CREATE OR REPLACE FUNCTION public.cancel_my_donation(p_donation_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_id text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role IN ('merchant', 'admin') AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  UPDATE public.donations d
     SET status = 'cancelado'
   WHERE d.id::text = p_donation_id AND d.status = 'disponivel'
     AND (public.is_nutre_admin() OR d.merchant_id = auth.uid())
   RETURNING d.id::text INTO cancelled_id;

  IF cancelled_id IS NULL THEN
    RAISE EXCEPTION 'A doação não pode ser cancelada';
  END IF;
  RETURN true;
END;
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
  pickup_hours text
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
         p.pickup_hours
    FROM public.donations d
    LEFT JOIN public.profiles p ON p.id = d.merchant_id
    LEFT JOIN public.donation_pickup_vouchers v ON v.donation_id = d.id::text
   WHERE d.reserved_by = auth.uid()
   ORDER BY d.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.release_expired_donations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_donation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_pickup_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_my_donation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_reserved_donations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_expired_donations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_donation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pickup_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_donation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_reserved_donations() TO authenticated;

REVOKE UPDATE ON public.donations FROM PUBLIC, anon, authenticated;
