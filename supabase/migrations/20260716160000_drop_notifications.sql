-- Migration to drop the unused notifications table and related triggers/functions
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Drop triggers that depend on the notifications table
DROP TRIGGER IF EXISTS on_profile_created_notification ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_new_order ON public.orders CASCADE;
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders CASCADE;

-- Drop functions that handle notifications
DROP FUNCTION IF EXISTS public.handle_welcome_notification() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_order_notification() CASCADE;
DROP FUNCTION IF EXISTS public.handle_order_status_notification() CASCADE;
DROP FUNCTION IF EXISTS public.handle_low_stock_notification() CASCADE;
