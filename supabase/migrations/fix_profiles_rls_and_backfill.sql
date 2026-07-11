-- ============================================================
-- Fix: "Gagal memuat profil pengguna"
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── FIX 1: Ensure profiles has correct RLS policies ─────────

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old/conflicting policies first
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

-- Allow each user to SELECT their own profile
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

-- Allow each user to UPDATE their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- Allow INSERT only from the trigger (service_role / SECURITY DEFINER context)
-- authenticated users should NOT be able to insert their own profile directly
CREATE POLICY "profiles_insert_service"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- ── FIX 2: Backfill missing profile rows ────────────────────
-- Create profile rows for any auth users that don't have one yet
-- (handles users registered before the trigger was fixed)

INSERT INTO public.profiles (id, full_name, phone_number, role, updated_at)
SELECT
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.email, '')), ''),
  nullif(trim(coalesce(
    u.raw_user_meta_data ->> 'phone_number',
    u.raw_user_meta_data ->> 'phone',
    ''
  )), ''),
  'customer'::public.user_role,
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ── FIX 3: Confirm the trigger function is up to date ───────
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
  RAISE WARNING 'handle_new_user failed for auth user %. SQLSTATE=%, error=%',
    NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-create trigger (drop all first to avoid duplicates)
DO $$
DECLARE
  v_trigger record;
BEGIN
  FOR v_trigger IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', v_trigger.tgname);
  END LOOP;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ── VERIFY: Check the fix worked ────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS "total profiles",
  (SELECT COUNT(*) FROM auth.users) AS "total auth users",
  (
    SELECT COUNT(*) FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  ) AS "users without profile (should be 0)";
