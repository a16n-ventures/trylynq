-- Add email column to profiles table for friend matching
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Create trigger to populate profile from auth.users on signup
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update email from auth.users when profile is created
  UPDATE public.profiles
  SET email = (SELECT email FROM auth.users WHERE id = NEW.user_id)
  WHERE user_id = NEW.user_id AND email IS NULL;
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS on_profile_created_sync_email ON public.profiles;
CREATE TRIGGER on_profile_created_sync_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- Enable realtime for user_locations table
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;

-- Enable realtime for friendships table
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;