-- ============================================================
-- Diagnostic + Fix: "Gagal memuat profil pengguna"
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── STEP 1: Diagnose current state ──────────────────────────
-- 1a. Check RLS status on profiles
SELECT relname, relrowsecurity AS "RLS enabled", relforcerowsecurity AS "Force RLS"
FROM pg_class
WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace;

-- 1b. Check existing RLS policies
SELECT policyname, roles, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 1c. Count how many profiles exist
SELECT COUNT(*) AS "total profiles" FROM public.profiles;

-- 1d. Count auth users with no profile (orphaned)
SELECT COUNT(*) AS "users without profile"
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
