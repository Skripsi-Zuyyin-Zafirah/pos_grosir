-- Migration: Hapus versi lama checkout_order yang tidak menyimpan user_id
-- Versi lama: checkout_order(text, numeric, integer, integer, jsonb)
-- Digantikan oleh: checkout_order(text, numeric, jsonb, integer, numeric)
-- yang menyertakan auth.uid() sebagai user_id pada insert ke tabel orders.

DROP FUNCTION IF EXISTS public.checkout_order(
  p_customer_name text,
  p_total_price   numeric,
  p_total_items   integer,
  p_ewp           integer,
  p_items         jsonb
);
