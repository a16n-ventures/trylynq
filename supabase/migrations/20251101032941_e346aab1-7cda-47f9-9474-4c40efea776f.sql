-- Add location coordinates to profiles table
ALTER TABLE public.profiles
ADD COLUMN latitude NUMERIC,
ADD COLUMN longitude NUMERIC,
ADD COLUMN location_updated_at TIMESTAMP WITH TIME ZONE;

-- Create user_locations table for real-time location tracking
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC,
  is_sharing_location BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for user_locations
CREATE POLICY "Users can view friends' locations"
ON public.user_locations
FOR SELECT
USING (
  is_sharing_location = true AND (
    user_id = auth.uid() OR
    user_id IN (
      SELECT requester_id FROM friendships 
      WHERE addressee_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT addressee_id FROM friendships 
      WHERE requester_id = auth.uid() AND status = 'accepted'
    )
  )
);

CREATE POLICY "Users can insert their own location"
ON public.user_locations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own location"
ON public.user_locations
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on user_locations
CREATE TRIGGER update_user_locations_updated_at
BEFORE UPDATE ON public.user_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create contacts table for imported contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  is_app_user BOOLEAN DEFAULT false,
  matched_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Users can view their own contacts"
ON public.contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
ON public.contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.contacts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.contacts
FOR DELETE
USING (auth.uid() = user_id);