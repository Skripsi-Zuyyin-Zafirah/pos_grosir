-- Migration: Rewrite handle_new_user trigger with direct, non-dynamic INSERT
-- Fixes "Database error saving new user" caused by:
--   1. Dynamic SQL parameter ($1/$2/$3) misalignment when optional columns vary
--   2. Querying for 'pembeli' enum label that doesn't exist in user_role
--   3. Column existence checks that could produce wrong USING parameter binding

-- Drop and recreate the function with a direct, safe INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name    text;
  v_phone_number text;
BEGIN
  -- Extract metadata safely
  v_full_name := nullif(trim(coalesce(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    ''
  )), '');

  v_phone_number := nullif(trim(coalesce(
    NEW.raw_user_meta_data ->> 'phone_number',
    NEW.raw_user_meta_data ->> 'phone',
    ''
  )), '');

  -- Direct INSERT matching the exact profiles schema:
  --   id, full_name, phone_number, role, updated_at
  -- Role defaults to 'customer' for all self-registered users.
  INSERT INTO public.profiles (id, full_name, phone_number, role, updated_at)
  VALUES (
    NEW.id,
    v_full_name,
    v_phone_number,
    'customer'::public.user_role,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but never block auth from creating the user
  RAISE WARNING 'handle_new_user failed for auth user %. SQLSTATE=%, error=%',
    NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop ALL existing triggers on auth.users (avoid duplicates)
DO $$
DECLARE
  v_trigger record;
BEGIN
  FOR v_trigger IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', v_trigger.tgname);
  END LOOP;
END;
$$;

-- Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Lock down function access
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;